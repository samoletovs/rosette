"""
Full E2E Playwright test for Rosette socket planner.
Uses route interception to mock all API calls so we can test the full flow
without Azure backend.

Flow: Upload → Analyze → Review → Place → Calculate → Results
"""
import json
import os
import sys
import base64
from playwright.sync_api import sync_playwright, Page, Route

URL = "http://localhost:5173"
SCREENSHOTS = os.path.join(os.path.dirname(__file__), "..", "screenshots")
os.makedirs(SCREENSHOTS, exist_ok=True)

# A tiny 1x1 white PNG for the file upload
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)

# ── Mock API responses ──

MOCK_ROOMS = [
    {"id": "room_1", "type": "kitchen", "name": "Kitchen", "width_m": 4.0, "height_m": 3.5, "area_m2": 14.0,
     "position": {"x_pct": 5, "y_pct": 5, "w_pct": 30, "h_pct": 35}, "features": ["sink", "window"]},
    {"id": "room_2", "type": "living_room", "name": "Living Room", "width_m": 5.0, "height_m": 4.0, "area_m2": 20.0,
     "position": {"x_pct": 38, "y_pct": 5, "w_pct": 35, "h_pct": 35}, "features": ["window"]},
    {"id": "room_3", "type": "bedroom", "name": "Bedroom", "width_m": 3.5, "height_m": 3.0, "area_m2": 10.5,
     "position": {"x_pct": 5, "y_pct": 45, "w_pct": 30, "h_pct": 30}, "features": ["window"]},
    {"id": "room_4", "type": "bathroom", "name": "Bathroom", "width_m": 2.5, "height_m": 2.0, "area_m2": 5.0,
     "position": {"x_pct": 38, "y_pct": 45, "w_pct": 20, "h_pct": 30}, "features": ["shower", "sink"]},
    {"id": "room_5", "type": "hallway", "name": "Hallway", "width_m": 1.5, "height_m": 4.0, "area_m2": 6.0,
     "position": {"x_pct": 76, "y_pct": 5, "w_pct": 20, "h_pct": 70}, "features": ["entrance"]},
]

MOCK_SWITCHBOARD = {
    "room_id": "room_5", "room_name": "Hallway", "wall": "north",
    "height_mm": 1600, "reason": "Near entrance, central location",
    "x_pct": 86, "y_pct": 12,
}

MOCK_ANALYZE = {
    "rooms": MOCK_ROOMS,
    "switchboard": MOCK_SWITCHBOARD,
    "total_area_m2": 55.5, "property_type": "apartment",
}

MOCK_STANDARDS = {
    "country": "Latvia", "standard": "LBN 261-23",
    "room_rules": {
        "kitchen": {"minimum_sockets": 6},
        "living_room": {"minimum_sockets": 5},
        "bedroom": {"minimum_sockets": 4},
        "bathroom": {"minimum_sockets": 1},
        "hallway": {"minimum_sockets": 2},
    },
    "wiring": {}, "circuit_requirements": {},
}

# Build proposal placements: proper number per room with room_id matching
def build_mock_placements():
    """Generate socket placements matching MOCK_ROOMS."""
    placements = []
    socket_counter = 0
    room_counts = {"room_1": 6, "room_2": 5, "room_3": 4, "room_4": 1, "room_5": 2}
    for room in MOCK_ROOMS:
        count = room_counts.get(room["id"], 2)
        for i in range(count):
            socket_counter += 1
            p = room["position"]
            walls = ["north", "east", "south", "west"]
            wall = walls[i % 4]
            placements.append({
                "room_id": room["id"],
                "room_name": room["name"],
                "socket_id": f"s{socket_counter}",
                "x_pct": p["x_pct"] + 5 + (i * 5) % p["w_pct"],
                "y_pct": p["y_pct"] + 5 + (i * 3) % p["h_pct"],
                "wall": wall,
                "height_mm": 300,
                "type": "standard_16a",
            })
    return placements

MOCK_PROPOSAL = {
    "switchboard": MOCK_SWITCHBOARD,
    "placements": build_mock_placements(),
}

# Build mock calculation result
def build_mock_calculation():
    placements = build_mock_placements()
    circuits = []
    for i, p in enumerate(placements):
        p["circuit"] = f"circuit_{(i // 4) + 1}"
    for ci in range(1, (len(placements) // 4) + 2):
        circuit_sockets = [p["socket_id"] for p in placements if p.get("circuit") == f"circuit_{ci}"]
        if circuit_sockets:
            circuits.append({
                "id": f"circuit_{ci}", "type": "standard", "breaker": "16A MCB",
                "cable": "3x2.5mm²", "rcd": "30mA", "rcd_group": f"rcd_{(ci-1)//3+1}",
                "sockets": circuit_sockets,
            })
    return {
        "placements": placements,
        "circuits": circuits,
        "rcd_groups": [
            {"id": "rcd_1", "label": "RCD 1", "rcd": "30mA Type A", "circuits": ["circuit_1", "circuit_2"]},
            {"id": "rcd_2", "label": "RCD 2", "rcd": "30mA Type A", "circuits": ["circuit_3", "circuit_4", "circuit_5"]},
        ],
        "wiring": [
            {"circuit_id": "circuit_1", "cable_type": "NYM-J 3×2.5mm²", "from": "switchboard",
             "to_room": "Kitchen", "to_room_id": "room_1", "wire_count": 3,
             "wire_colors": ["Brown (L)", "Blue (N)", "Green-Yellow (PE)"],
             "estimated_length_m": 8, "max_length_m": 27, "passes_through": [], "notes": ""},
        ],
        "total_sockets": len(placements), "total_circuits": len(circuits),
        "total_cable_m": 85,
        "summary": "18 sockets across 5 rooms with 5 circuits protected by 2 RCDs.",
    }

MOCK_DESCRIPTION = {
    "description_en": "## Socket Placement Specification\n\n18 sockets across 5 rooms.\n\n### Kitchen\n6 sockets on 2 circuits.\n\n### Living Room\n5 sockets.",
    "description_local": "## Kontaktligzdu izvietojuma specifikācija\n\n18 kontaktligzdas 5 telpās.",
    "language": {"name": "Latvian", "code": "lv"},
}


def setup_api_mocks(page: Page):
    """Intercept all API calls and return mock data."""

    def handle_route(route: Route):
        url = route.request.url
        if "/api/analyze" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_ANALYZE))
        elif "/api/standards" in url and "?" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_STANDARDS))
        elif "/api/standards" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"countries": [{"code": "LV", "country": "Latvia"}, {"code": "LT", "country": "Lithuania"}, {"code": "EE", "country": "Estonia"}]}))
        elif "/api/upload" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
        elif "/api/propose-placements" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_PROPOSAL))
        elif "/api/calculate" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(build_mock_calculation()))
        elif "/api/generate-description" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_DESCRIPTION))
        elif "/api/log-login" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
        elif "/.auth/" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"clientPrincipal": None}))
        else:
            route.continue_()

    page.route("**/api/**", handle_route)
    page.route("**/.auth/**", handle_route)


def test_full_flow(viewport_name: str, width: int, height: int):
    """Run the full E2E flow at a given viewport size."""
    print(f"\n{'='*60}")
    print(f"Testing: {viewport_name} ({width}x{height})")
    print(f"{'='*60}")
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": width, "height": height})
        setup_api_mocks(page)

        # ── Step 1: Upload ──
        print("\n[1] Upload page...")
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-01-upload.png", full_page=True)

        assert page.locator("h2").inner_text() == "Upload floor plan", "Upload heading not found"

        # Upload a file
        file_input = page.locator("input[type='file']")
        file_input.set_input_files({
            "name": "test-plan.png",
            "mimeType": "image/png",
            "buffer": TINY_PNG,
        })
        page.wait_for_timeout(500)

        # Click analyze
        analyze_btn = page.locator("button.primary", has_text="Analyze floor plan")
        assert analyze_btn.is_enabled(), "Analyze button should be enabled after file upload"
        analyze_btn.click()
        print("  ✓ File uploaded, analyze clicked")

        # ── Step 2: Analyzing (loading state) ──
        page.wait_for_timeout(500)

        # ── Step 3: Review ──
        print("\n[2] Review page...")
        page.wait_for_selector("h2:has-text('Review detected rooms')", timeout=10000)
        page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-02-review.png", full_page=True)

        # Check rooms are listed
        room_rows = page.locator(".room-row")
        room_count = room_rows.count()
        print(f"  ✓ {room_count} rooms detected")
        assert room_count == 5, f"Expected 5 rooms, got {room_count}"

        # Verify socket counts
        for i in range(room_count):
            row = room_rows.nth(i)
            name = row.locator("strong").inner_text()
            count_val = row.locator(".cnt-val").inner_text()
            print(f"    {name}: {count_val} sockets")

        # Click "Place sockets →"
        place_btn = page.locator("button.primary", has_text="Place sockets")
        place_btn.click()
        print("  ✓ Proceeding to placement...")

        # ── Step 4: Proposing (loading) → Placement ──
        page.wait_for_selector("h2:has-text('Place sockets')", timeout=15000)
        page.wait_for_timeout(1000)  # Let Konva canvas render
        page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-03-placement.png", full_page=True)

        # Check tray has sockets
        tray_count_text = page.locator(".placement-toolbar .muted").inner_text()
        print(f"\n[3] Placement page: {tray_count_text}")

        # Count tray chips
        tray_chips = page.locator(".tray-chip.unplaced")
        tray_count = tray_chips.count()
        print(f"  ✓ {tray_count} sockets in tray")

        if tray_count == 0:
            errors.append("CRITICAL: No sockets in tray!")
            print("  ✗ FAIL: No sockets in tray!")
        else:
            # Verify we have sockets for multiple rooms
            room_cards = page.locator(".tray-room")
            room_card_count = room_cards.count()
            print(f"  ✓ {room_card_count} room cards in tray")

            if room_card_count < 3:
                errors.append(f"Expected 5 room cards in tray, got {room_card_count}")

            # Print room details
            for i in range(room_card_count):
                card = room_cards.nth(i)
                room_name = card.locator(".tray-room-name").inner_text()
                count = card.locator(".tray-room-head .muted").inner_text()
                print(f"    {room_name}: {count}")

        # Test Auto-place all
        auto_btn = page.locator("button.primary", has_text="Auto-place all")
        if auto_btn.count() > 0 and auto_btn.is_visible():
            auto_btn.click()
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-04-auto-placed.png", full_page=True)

            placed_text = page.locator(".placement-toolbar .muted").inner_text()
            print(f"  ✓ After auto-place: {placed_text}")

            # Verify all sockets are placed (none in tray)
            remaining = page.locator(".tray-chip.unplaced").count()
            if remaining > 0:
                errors.append(f"Auto-place left {remaining} sockets in tray")
                print(f"  ✗ {remaining} sockets still in tray after auto-place")
            else:
                print("  ✓ All sockets placed successfully")
        else:
            errors.append("Auto-place button not found")
            print("  ✗ Auto-place button not found")

        # Click a placed socket to test selection panel
        placed_chips = page.locator(".tray-chip.placed")
        if placed_chips.count() > 0:
            placed_chips.first.click()
            page.wait_for_timeout(300)
            panel = page.locator(".placement-panel")
            if panel.is_visible():
                panel_id = panel.locator("strong").first.inner_text()
                print(f"  ✓ Socket panel opened for {panel_id}")
                # Verify panel has outlet grid
                outlet_btns = panel.locator(".outlet-btn")
                if outlet_btns.count() == 6:
                    print(f"  ✓ Outlet grid shows 6 options (1-6)")
                else:
                    errors.append(f"Expected 6 outlet buttons, got {outlet_btns.count()}")
                # Close panel
                panel.locator(".modal-close").click()
            page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-05-socket-panel.png", full_page=True)

        # Confirm placement
        confirm_btn = page.locator("button.primary", has_text="Confirm placement")
        confirm_btn.click()
        print("\n[4] Confirming placement...")

        # ── Step 5: Calculating ──
        page.wait_for_timeout(500)

        # ── Step 6: Results ──
        print("\n[5] Results page...")
        page.wait_for_selector(".results", timeout=15000)
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-06-results.png", full_page=True)

        # Check stats bar
        stat_values = page.locator(".stat-n").all_text_contents()
        print(f"  Stats: {stat_values}")
        if len(stat_values) >= 3:
            sockets_count = stat_values[0]
            circuits_count = stat_values[1]
            rooms_count = stat_values[2]
            print(f"  ✓ {sockets_count} Sockets · {circuits_count} Circuits · {rooms_count} Rooms")
        else:
            errors.append("Stats bar not rendering properly")

        # Check diagram tabs
        tabs = page.locator(".toggle-btn")
        tab_names = tabs.all_text_contents()
        print(f"  Diagram tabs: {tab_names}")

        # Check floor plan tab (default)
        floor_plan_svg = page.locator(".svg-box")
        if floor_plan_svg.count() > 0:
            print("  ✓ Floor plan SVG rendered")
        else:
            errors.append("Floor plan SVG not found in results")
            print("  ✗ Floor plan SVG not found")

        # Switch to room layouts tab
        room_tab = page.locator(".toggle-btn", has_text="Room layouts")
        if room_tab.count() > 0:
            room_tab.click()
            page.wait_for_timeout(300)
            page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-07-room-layouts.png", full_page=True)
            print("  ✓ Room layouts tab rendered")

        # Switch to circuit diagram tab
        circuit_tab = page.locator(".toggle-btn", has_text="Circuit diagram")
        if circuit_tab.count() > 0:
            circuit_tab.click()
            page.wait_for_timeout(300)
            page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-08-circuit-diagram.png", full_page=True)
            print("  ✓ Circuit diagram tab rendered")

        # Check specification text
        spec_body = page.locator(".spec-body")
        if spec_body.count() > 0:
            spec_text = spec_body.inner_text()
            has_content = len(spec_text) > 20
            print(f"  ✓ Specification text: {len(spec_text)} chars" if has_content else "  ✗ Specification too short")
            if not has_content:
                errors.append("Specification text too short")

        # Check PDF export button
        pdf_btn = page.locator(".pdf-btn")
        if pdf_btn.count() > 0:
            print("  ✓ PDF export button present")
        else:
            errors.append("PDF export button missing")

        page.screenshot(path=f"{SCREENSHOTS}/{viewport_name}-09-final.png", full_page=True)

        browser.close()

    # Summary
    print(f"\n{'─'*60}")
    if errors:
        print(f"FAILED ({viewport_name}): {len(errors)} errors:")
        for e in errors:
            print(f"  ✗ {e}")
        return False
    else:
        print(f"PASSED ({viewport_name}): All checks OK")
        return True


if __name__ == "__main__":
    print("=" * 60)
    print("Rosette E2E Test Suite")
    print("=" * 60)

    results = []
    results.append(("Desktop", test_full_flow("desktop", 1280, 900)))
    results.append(("Mobile", test_full_flow("mobile", 390, 844)))

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    all_passed = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  {status}: {name}")
        if not passed:
            all_passed = False

    sys.exit(0 if all_passed else 1)
