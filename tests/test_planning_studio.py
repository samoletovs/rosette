"""Exercise the real UI with fictional API responses, never a live product."""
from __future__ import annotations

import argparse
import json
import logging
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

from playwright.sync_api import Browser, Page, Route, expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ROOMS = [
    {"id": "living", "name": "Living room", "type": "living_room", "area_m2": 24, "width_m": 6, "height_m": 4, "position": {"x_pct": 5, "y_pct": 5, "w_pct": 47, "h_pct": 49}, "features": []},
    {"id": "kitchen", "name": "Kitchen", "type": "kitchen", "area_m2": 12, "width_m": 4, "height_m": 3, "position": {"x_pct": 54, "y_pct": 5, "w_pct": 40, "h_pct": 49}, "features": []},
    {"id": "bedroom", "name": "Bedroom", "type": "bedroom", "area_m2": 16, "width_m": 4, "height_m": 4, "position": {"x_pct": 5, "y_pct": 57, "w_pct": 35, "h_pct": 31}, "features": []},
    {"id": "bathroom", "name": "Bathroom", "type": "bathroom", "area_m2": 6, "width_m": 3, "height_m": 2, "position": {"x_pct": 71, "y_pct": 57, "w_pct": 23, "h_pct": 31}, "features": []},
    {"id": "hall", "name": "Hallway", "type": "hallway", "area_m2": 6, "width_m": 3, "height_m": 2, "position": {"x_pct": 42, "y_pct": 57, "w_pct": 27, "h_pct": 31}, "features": []},
]
BOARD = {"room_id": "hall", "room_name": "Hallway", "wall": "north", "height_mm": 1600, "reason": "Synthetic fixture", "x_pct": 52, "y_pct": 72}
COUNTRIES = [{"code": "LV", "country": "Latvia"}, {"code": "LT", "country": "Lithuania"}, {"code": "EE", "country": "Estonia"}]
LANGUAGES = {"LV": "Latvian", "LT": "Lithuanian", "EE": "Estonian"}


def fulfill(route: Route, body: dict, status: int = 200) -> None:
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body))


def calculation(payload: dict) -> dict:
    positions = [dict(item, circuit="fixture-circuit") for item in payload["confirmedPlacements"]]
    return {
        "placements": positions, "total_sockets": len(positions), "total_circuits": 1,
        "total_cable_m": 0, "wiring": [], "rcd_groups": [],
        "circuits": [{"id": "fixture-circuit", "sockets": [item["socket_id"] for item in positions], "breaker": "TEST", "cable": "TEST"}],
        "summary": "Synthetic browser fixture — not an electrical design or installation instruction.",
    }


def make_plan(page: Page) -> bytes:
    """Render an original synthetic drawing solely as the test upload fixture."""
    page.set_viewport_size({"width": 800, "height": 560})
    page.set_content("""<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560">
      <rect width="800" height="560" fill="#fffdf8"/><g fill="#f4f0e7" stroke="#302f28" stroke-width="6">
      <rect x="44" y="34" width="380" height="274"/><rect x="434" y="34" width="320" height="274"/>
      <rect x="44" y="318" width="280" height="172"/><rect x="334" y="318" width="220" height="172"/><rect x="564" y="318" width="190" height="172"/></g>
      <g fill="#302f28" font-family="Georgia,serif" font-size="22" text-anchor="middle">
      <text x="234" y="170">Living room · 24 m²</text><text x="594" y="170">Kitchen · 12 m²</text>
      <text x="184" y="405">Bedroom · 16 m²</text><text x="444" y="405">Hallway · 6 m²</text><text x="659" y="405">Bathroom · 6 m²</text>
      <text x="400" y="538" font-family="sans-serif" font-size="16">SYNTHETIC TEST PLAN · NOT TO SCALE · NO ELECTRICAL DESIGN</text></g></svg></body></html>""")
    return page.screenshot()


def install_mocks(page: Page, origin: str) -> dict:
    state: dict = {"analyze": [], "calculate": [], "held_analysis": None, "held_calculation": None, "external": []}

    def handler(route: Route) -> None:
        parsed = urlparse(route.request.url)
        if parsed.scheme == "data" or (parsed.scheme == "blob" and parsed.path.startswith(origin + "/")):
            route.continue_()
            return
        if f"{parsed.scheme}://{parsed.netloc}" != origin:
            state["external"].append(route.request.url)
            route.abort()
            return
        path = parsed.path
        if path == "/.auth/me":
            fulfill(route, {"clientPrincipal": None})
        elif path.startswith("/.auth/"):
            route.abort()
        elif path == "/api/standards":
            fulfill(route, {"countries": COUNTRIES})
        elif path.startswith("/api/standards/"):
            code = path.rsplit("/", 1)[1]
            country = next(item["country"] for item in COUNTRIES if item["code"] == code)
            fulfill(route, {"country": country, "country_code": code, "standard": "Synthetic test reference", "room_rules": {room["type"]: {"minimum_sockets": 2} for room in ROOMS}})
        elif path == "/api/upload":
            fulfill(route, {"id": "synthetic", "url": f"{origin}/synthetic-not-stored.png", "blobName": "synthetic"})
        elif path == "/api/analyze":
            state["analyze"].append(route.request.post_data_json)
            if len(state["analyze"]) == 1:
                state["held_analysis"] = route
            else:
                fulfill(route, {"rooms": ROOMS, "switchboard": BOARD, "total_area_m2": 64})
        elif path == "/api/calculate":
            payload = route.request.post_data_json
            state["calculate"].append(payload)
            if len(state["calculate"]) == 1:
                state["held_calculation"] = route
            else:
                fulfill(route, calculation(payload))
        elif path == "/api/generate-description":
            code = route.request.post_data_json["countryCode"]
            fulfill(route, {
                "description_en": "## Synthetic review specification\n\nNOT AN ELECTRICAL DESIGN.\n\n| Room | Conversation |\n|---|---|\n| Living room | " + "Long-content test " * 24 + "|\n",
                "description_local": f"## {LANGUAGES[code]} synthetic specification\n\nĀ ē ī ū — synthetic language/output fixture only.",
                "language": {"name": LANGUAGES[code], "code": code.lower()},
            })
        elif path.startswith("/api/"):
            fulfill(route, {"error": f"Unexpected test API: {path}"}, 500)
        else:
            route.continue_()

    page.route("**/*", handler)
    return state


def capture(page: Page, directory: Path, name: str) -> None:
    page.evaluate("window.scrollTo(0, 0)")
    page.screenshot(path=str(directory / f"{name}.png"), full_page=True, scale="css")


def assert_no_overflow(page: Page) -> None:
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Page-wide horizontal overflow"


def held_route(page: Page, state: dict, key: str) -> Route:
    deadline = time.monotonic() + 5
    while state[key] is None and time.monotonic() < deadline:
        page.wait_for_timeout(20)
    assert state[key] is not None, f"The expected mocked request did not start: {key}"
    return state[key]


def journey(browser: Browser, url: str, output: Path, width: int) -> dict:
    name = "desktop" if width >= 1024 else "mobile"
    context = browser.new_context(viewport={"width": width, "height": 1080 if width >= 1024 else 844}, accept_downloads=True)
    # Simulate the existing unlocked state only for exercising the actual PDF exporter.
    if name == "desktop":
        context.add_init_script("if (location.protocol === 'http:') localStorage.setItem('rosette-pdf-unlocked', 'true')")
    page = context.new_page()
    png = make_plan(page)
    page.set_viewport_size({"width": width, "height": 1080 if width >= 1024 else 844})
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    origin = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
    state = install_mocks(page, origin)
    page.goto(url)
    expect(page.get_by_role("button", name="Choose floor plan")).to_be_visible()
    expect(page.get_by_role("combobox", name="Country").locator("option")).to_have_count(3)
    page.get_by_role("combobox", name="Country").select_option("LV" if name == "desktop" else "EE")
    capture(page, output, f"{name}-upload")
    choose = page.get_by_role("button", name="Choose floor plan")
    choose.focus()
    with page.expect_file_chooser() as chooser:
        page.keyboard.press("Enter")
    chooser.value.set_files({"name": "synthetic-plan.png", "mimeType": "image/png", "buffer": png})
    expect(page.locator(".file-name")).to_have_text("synthetic-plan.png")
    # Invalid replacement must not discard the previously readable file.
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Choose a different plan").press("Space")
    chooser.value.set_files({"name": "not-a-plan.html", "mimeType": "text/html", "buffer": b"<p>test</p>"})
    expect(page.locator(".file-name")).to_have_text("synthetic-plan.png")
    page.get_by_role("button", name="Dismiss error").click()
    page.get_by_role("button", name="Analyze floor plan").click()
    expect(page.get_by_role("heading", name="Finding the rooms in your plan")).to_be_visible()
    capture(page, output, f"{name}-analysis-waiting")
    fulfill(held_route(page, state, "held_analysis"), {"error": "Synthetic service failure. Try again."}, 503)
    expect(page.get_by_role("alert")).to_contain_text("Synthetic service failure")
    expect(page.locator(".file-name")).to_have_text("synthetic-plan.png")
    capture(page, output, f"{name}-analysis-error")
    page.get_by_role("button", name="Try analysis again").click()
    expect(page.get_by_role("heading", name="Review detected rooms")).to_be_visible()
    assert state["analyze"][0] == state["analyze"][1], "Retry changed the selected plan or property"
    expect(page.locator(".room-row")).to_have_count(5)
    page.get_by_role("button", name="Increase sockets for Living room", exact=True).press("Enter")
    page.get_by_role("button", name="Add missing room").click()
    page.get_by_label("Name", exact=True).fill("A very long synthetic room name " * 6)
    page.get_by_role("button", name="Add room", exact=True).click()
    expect(page.locator(".room-row")).to_have_count(6)
    assert_no_overflow(page)
    page.locator(".room-row").last.get_by_role("button", name=re.compile("^Remove ")).click()
    expect(page.locator(".room-row")).to_have_count(5)
    capture(page, output, f"{name}-review")
    page.get_by_role("button", name="Back to plan").click()
    expect(page.locator(".file-name")).to_have_text("synthetic-plan.png")
    # Do not reanalyze: return via browser-independent UI by analyzing the retained file.
    page.get_by_role("button", name="Analyze floor plan").click()
    expect(page.locator(".room-row")).to_have_count(5)
    page.get_by_role("button", name="Increase sockets for Living room", exact=True).click()
    page.get_by_role("button", name="Place sockets").click()
    expect(page.get_by_role("heading", name="Place sockets & distribution board")).to_be_visible()
    for room in ROOMS:
        page.get_by_role("button", name=f"Place sockets in {room['name']}", exact=True).press("Enter")
        form = page.locator(".point-controls")
        position = room["position"]
        form.get_by_label("Horizontal position (%)").fill(str(position["x_pct"] + position["w_pct"] / 2))
        form.get_by_label("Vertical position (%)").fill(str(position["y_pct"] + position["h_pct"] / 2))
        form.get_by_role("button", name="Place at point").press("Enter")
    page.get_by_role("button", name="Place distribution board", exact=True).click()
    page.locator(".point-controls").get_by_role("button", name="Place at point").click()
    placed_before = page.locator(".placement-toolbar .muted").inner_text()
    capture(page, output, f"{name}-placement")
    page.get_by_role("button", name="Confirm placement").click()
    expect(page.get_by_role("heading", name="Calculating your plan", exact=True)).to_be_visible()
    capture(page, output, f"{name}-calculation-waiting")
    fulfill(held_route(page, state, "held_calculation"), {"error": "Synthetic calculation interruption"}, 503)
    expect(page.get_by_role("button", name="Retry calculation")).to_be_visible()
    expect(page.locator(".placement-toolbar .muted")).to_have_text(placed_before)
    expect(page.locator(".room-card.done")).to_have_count(6)
    capture(page, output, f"{name}-calculation-error")
    page.get_by_role("button", name="Retry calculation").click()
    expect(page.locator(".results")).to_be_visible(timeout=20000)
    assert state["calculate"][0] == state["calculate"][1], "Retry lost or changed confirmed room/placement data"
    expected_country = "LV" if name == "desktop" else "EE"
    assert state["calculate"][1]["countryCode"] == expected_country
    assert state["calculate"][1]["rooms"][0]["requested_sockets"] == 3
    expect(page.locator(".stat-n").nth(0)).to_have_text("11")
    expect(page.locator(".results")).to_contain_text("Synthetic browser fixture")
    assert_no_overflow(page)
    for label in ("Room layouts", "Circuit diagram", "Wiring plan", "Floor plan"):
        page.get_by_role("button", name=label, exact=True).click()
        expect(page.locator(".plan-box svg")).to_be_visible()
    with page.expect_download() as downloaded:
        page.get_by_role("button", name="Download socket plan").click()
    downloaded.value.save_as(str(output / f"{name}-socket-plan.svg"))
    assert "<svg" in (output / f"{name}-socket-plan.svg").read_text(encoding="utf-8")
    page.get_by_role("button", name=re.compile(LANGUAGES[expected_country])).click()
    expect(page.locator(".spec-body")).to_contain_text(f"{LANGUAGES[expected_country]} synthetic specification")
    with page.expect_download() as downloaded:
        page.get_by_role("button", name="Download specification").click()
    downloaded.value.save_as(str(output / f"{name}-specification.md"))
    assert "synthetic specification" in (output / f"{name}-specification.md").read_text(encoding="utf-8")
    if name == "desktop":
        with page.expect_download(timeout=30000) as downloaded:
            page.get_by_role("button", name="Download A3 planning PDF").click()
        path = output / "desktop-planning.pdf"
        downloaded.value.save_as(str(path))
        assert path.read_bytes().startswith(b"%PDF"), "PDF export did not produce a PDF"
    else:
        page.get_by_role("button", name="Get A3 planning PDF").click()
        expect(page.get_by_role("dialog", name="PDF export paywall")).to_be_visible()
        page.keyboard.press("Escape")
        expect(page.get_by_role("dialog")).to_have_count(0)
    capture(page, output, name)
    for check_width in (320, 390, 768, 1440):
        page.set_viewport_size({"width": check_width, "height": 900})
        assert_no_overflow(page)
    page.evaluate("document.documentElement.style.fontSize = '200%'")
    assert_no_overflow(page)
    page.evaluate("document.documentElement.style.fontSize = ''")
    page.emulate_media(reduced_motion="reduce")
    assert page.evaluate("document.getAnimations().length") == 0
    page.get_by_role("button", name="Plan another property").click()
    expect(page.get_by_role("button", name="Choose floor plan")).to_be_visible()
    assert not state["external"], state["external"]
    assert not errors, errors
    resources = page.evaluate("performance.getEntriesByType('resource').map(e => ({name:e.name, duration:e.duration, transferSize:e.transferSize}))")
    result = {"viewport": name, "width": width, "passed": True, "calculateRequests": len(state["calculate"]), "resources": resources, "notes": "Mocked services; local resource timings are not field Core Web Vitals."}
    context.close()
    return result


def empty_states(browser: Browser, url: str, output: Path) -> dict:
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    png = make_plan(page)
    page.set_viewport_size({"width": 390, "height": 844})
    parsed = urlparse(url)
    state = install_mocks(page, f"{parsed.scheme}://{parsed.netloc}")
    page.goto(url)
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name="Choose floor plan").press("Enter")
    chooser.value.set_files({"name": "empty-detection-fixture.png", "mimeType": "image/png", "buffer": png})
    page.get_by_role("button", name="Analyze floor plan").click()
    expect(page.get_by_role("heading", name="Finding the rooms in your plan")).to_be_visible()
    fulfill(held_route(page, state, "held_analysis"), {"rooms": []})
    expect(page.get_by_role("alert")).to_contain_text("No rooms detected")
    expect(page.locator(".file-name")).to_have_text("empty-detection-fixture.png")
    capture(page, output, "mobile-empty-analysis")
    page.get_by_role("button", name="Try analysis again").click()
    expect(page.locator(".room-row")).to_have_count(5)
    for _ in ROOMS:
        page.locator(".room-row").first.get_by_role("button", name=re.compile("^Remove ")).click()
    expect(page.get_by_role("button", name="Place sockets")).to_be_disabled()
    expect(page.locator(".review-layout")).to_contain_text("No rooms remain")
    capture(page, output, "mobile-empty-review")
    page.get_by_role("button", name="Add missing room").click()
    page.get_by_role("button", name="Add room", exact=True).click()
    expect(page.locator(".room-row")).to_have_count(1)
    expect(page.get_by_role("button", name="Place sockets")).to_be_enabled()
    assert not state["external"]
    context.close()
    return {"emptyAnalysisRetainsFile": True, "emptyReviewRecoverable": True}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:4178")
    parser.add_argument("--output", type=Path, default=ROOT / ".test-artifacts/planning-studio")
    parser.add_argument("--source", help="Require an exact source-revision.txt in the served build before evidence capture")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parsed = urlparse(args.url)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost"):
        parser.error("Use a local HTTP preview only; live product/auth is forbidden.")
    output = args.output.resolve()
    if not output.is_relative_to(ROOT):
        parser.error("Write test artifacts inside this project.")
    if output.is_relative_to(ROOT / "docs/design-evidence") and not args.source:
        parser.error("Product evidence capture requires --source and a matching served build marker.")
    if args.source:
        if not re.fullmatch(r"[0-9a-f]{40}", args.source):
            parser.error("--source must be a full Git commit.")
        with urlopen(args.url.rstrip("/") + "/source-revision.txt", timeout=10) as response:
            served = response.read().decode("utf-8").strip()
        if served != args.source:
            parser.error("The served build revision does not match --source.")
        head = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
        if head != args.source:
            parser.error("Capture from the exact committed source checkout, before evidence-only commits.")
        changes = subprocess.run(
            ["git", "-C", str(ROOT), "diff", "--name-only", "HEAD", "--", ".", ":(exclude)docs/design-evidence/**"],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        staged = subprocess.run(
            ["git", "-C", str(ROOT), "diff", "--cached", "--name-only", "HEAD", "--", ".", ":(exclude)docs/design-evidence/**"],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        untracked = subprocess.run(
            ["git", "-C", str(ROOT), "ls-files", "--others", "--exclude-standard", "-z"],
            check=True, capture_output=True, text=True,
        ).stdout.split("\0")
        if changes or staged or any(name and not name.startswith("docs/design-evidence/") for name in untracked):
            parser.error("Commit all source changes before product-evidence capture.")
    output.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            results = [journey(browser, args.url, output, width) for width in (1440, 390)]
            empty = empty_states(browser, args.url, output)
        finally:
            browser.close()
    report = {"source": args.source, "results": results, "emptyStates": empty, "elapsedSeconds": round(time.monotonic() - started, 2), "limitations": ["Chromium only", "Mocked backend, not live service validation", "No physical-device test or WCAG certification"]}
    (output / "browser-results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    logging.info("Planning-studio browser requirements passed at desktop and mobile.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
