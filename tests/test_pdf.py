"""
Quick test: Does the PDF export button work without errors?
Tests the full flow through to clicking the PDF export button.
"""
from playwright.sync_api import sync_playwright
import json, os

URL = "http://localhost:5173"
SCREENSHOTS = os.path.join(os.path.dirname(__file__), "..", "screenshots")
os.makedirs(SCREENSHOTS, exist_ok=True)

# Minimal mock data
MOCK_ROOMS = [
    {"id": "room_1", "type": "kitchen", "name": "Kitchen", "width_m": 4.0, "height_m": 3.5, "area_m2": 14.0,
     "position": {"x_pct": 5, "y_pct": 5, "w_pct": 30, "h_pct": 35}, "features": ["sink"]},
    {"id": "room_2", "type": "bedroom", "name": "Bedroom", "width_m": 3.5, "height_m": 3.0, "area_m2": 10.5,
     "position": {"x_pct": 40, "y_pct": 5, "w_pct": 30, "h_pct": 35}, "features": ["window"]},
]

MOCK_ANALYZE = {"rooms": MOCK_ROOMS, "switchboard": {"room_id": "room_1", "room_name": "Kitchen", "wall": "north", "height_mm": 1600, "reason": "Central"}, "total_area_m2": 24.5}
MOCK_STANDARDS = {"country": "Latvia", "room_rules": {"kitchen": {"minimum_sockets": 6}, "bedroom": {"minimum_sockets": 4}}, "wiring": {}, "circuit_requirements": {}}

def build_calc():
    placements = []
    for i in range(10):
        placements.append({"room_id": "room_1" if i < 6 else "room_2", "room_name": "Kitchen" if i < 6 else "Bedroom",
            "socket_id": f"s{i+1}", "x_pct": 10 + i*5, "y_pct": 20, "wall": "north", "height_mm": 300, "type": "standard_16a", "circuit": f"circuit_{i//4+1}"})
    return {
        "placements": placements,
        "circuits": [{"id": "circuit_1", "type": "standard", "breaker": "16A MCB", "cable": "3x2.5mm²", "rcd": "30mA", "rcd_group": "rcd_1", "sockets": ["s1","s2","s3","s4"]},
                     {"id": "circuit_2", "type": "standard", "breaker": "16A MCB", "cable": "3x2.5mm²", "rcd": "30mA", "rcd_group": "rcd_1", "sockets": ["s5","s6","s7","s8","s9","s10"]}],
        "rcd_groups": [{"id": "rcd_1", "label": "RCD 1", "rcd": "30mA Type A", "circuits": ["circuit_1", "circuit_2"]}],
        "wiring": [{"circuit_id": "circuit_1", "cable_type": "NYM-J 3×2.5mm²", "from": "switchboard", "to_room": "Kitchen", "to_room_id": "room_1", "wire_count": 3, "wire_colors": ["Brown (L)", "Blue (N)", "Green-Yellow (PE)"], "estimated_length_m": 8, "max_length_m": 27, "passes_through": [], "notes": ""}],
        "total_sockets": 10, "total_circuits": 2, "total_cable_m": 20, "summary": "10 sockets across 2 rooms."
    }

MOCK_DESC = {"description_en": "## Spec\n\n10 sockets.", "description_local": "## Spec LV\n\n10 kontaktligzdas.", "language": {"name": "Latvian", "code": "lv"}}

def setup_mocks(page):
    def handle(route):
        url = route.request.url
        if "/api/analyze" in url: route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_ANALYZE))
        elif "/api/standards" in url and "?" in url: route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_STANDARDS))
        elif "/api/standards" in url: route.fulfill(status=200, content_type="application/json", body=json.dumps({"countries": [{"code": "LV", "country": "Latvia"}]}))
        elif "/api/upload" in url: route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
        elif "/api/calculate" in url: route.fulfill(status=200, content_type="application/json", body=json.dumps(build_calc()))
        elif "/api/generate-description" in url: route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_DESC))
        elif "/api/log-login" in url: route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
        elif "/.auth/" in url: route.fulfill(status=200, content_type="application/json", body=json.dumps({"clientPrincipal": None}))
        else: route.continue_()
    page.route("**/api/**", handle)
    page.route("**/.auth/**", handle)

TINY_PNG = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'

def test_pdf():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        setup_mocks(page)

        # Collect console errors
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        # Upload
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.locator("input[type='file']").set_input_files({"name": "test.png", "mimeType": "image/png", "buffer": TINY_PNG})
        page.wait_for_timeout(500)
        page.locator("button.primary", has_text="Analyze floor plan").click()

        # Review
        page.wait_for_selector("h2:has-text('Review detected rooms')", timeout=10000)
        page.locator("button.primary", has_text="Place sockets").click()

        # Place — place all rooms
        page.wait_for_selector("h2:has-text('Place sockets')", timeout=10000)
        page.wait_for_timeout(1000)

        place_btns = page.locator(".room-card-btn:not(.add)")
        for i in range(place_btns.count()):
            btn = page.locator(".room-card-btn:not(.add)").first
            if not btn.is_visible(): break
            btn.click()
            page.wait_for_timeout(200)
            canvas = page.locator(".placement-canvas-wrap canvas").first
            box = canvas.bounding_box()
            if box:
                page.mouse.click(box["x"] + 100 + i * 150, box["y"] + 100 + (i % 2) * 100)
                page.wait_for_timeout(300)

        page.screenshot(path=f"{SCREENSHOTS}/pdf-01-placed.png")
        print(f"Placed sockets")

        # Confirm
        page.locator("button.primary", has_text="Confirm placement").click()

        # Results
        page.wait_for_selector(".results", timeout=15000)
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOTS}/pdf-02-results.png", full_page=True)
        print("Results page loaded")

        # Check diagram tabs
        tabs = page.locator(".toggle-btn").all_text_contents()
        print(f"Tabs: {tabs}")

        # Check each diagram renders
        for tab_name in ["Room layouts", "Circuit diagram", "Wiring plan", "Floor plan"]:
            tab = page.locator(f".toggle-btn", has_text=tab_name)
            if tab.count() > 0:
                tab.click()
                page.wait_for_timeout(500)
                svg = page.locator(".svg-box")
                has_content = svg.count() > 0
                print(f"  {tab_name}: {'✓ SVG rendered' if has_content else '✗ No SVG'}")

        # Try PDF export
        print("\nTesting PDF export...")
        pdf_btn = page.locator(".pdf-btn")
        if pdf_btn.count() > 0 and pdf_btn.is_visible():
            # Listen for download
            with page.expect_download(timeout=30000) as download_info:
                pdf_btn.click()
                print("  Clicked PDF button, waiting for download...")
            download = download_info.value
            path = download.path()
            size = os.path.getsize(path) if path else 0
            print(f"  ✓ PDF downloaded: {download.suggested_filename} ({size} bytes)")
            # Save a copy
            download.save_as(f"{SCREENSHOTS}/rosette-test-export.pdf")
        else:
            print("  ✗ PDF button not found or not visible")

        # Report errors
        if errors:
            print(f"\nConsole errors ({len(errors)}):")
            for e in errors[:10]:
                print(f"  ✗ {e[:200]}")
        else:
            print("\n✓ No console errors")

        browser.close()

if __name__ == "__main__":
    test_pdf()
