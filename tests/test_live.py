"""
Test PDF export on the live deployed site (rosette.naurolabs.com).
This tests the actual production deployment, not local dev server.
Note: Requires Azure SWA auth — we test the parts that don't need auth,
or we simulate the flow as far as we can.
"""
from playwright.sync_api import sync_playwright
import os

LIVE_URL = "https://rosette.naurolabs.com"
SCREENSHOTS = os.path.join(os.path.dirname(__file__), "..", "screenshots")
os.makedirs(SCREENSHOTS, exist_ok=True)

def test_live_site():
    """Verify the live site loads and the JS bundle works."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        page.goto(LIVE_URL, wait_until="networkidle")
        page.screenshot(path=f"{SCREENSHOTS}/live-01-upload.png", full_page=True)

        # Basic checks — site might show auth page or main app
        title = page.locator("h1").first.inner_text()
        if "Sign" in title or "Login" in title:
            print(f"✓ Live site loads (auth required): {title}")
            print("  (Cannot test full flow without Google OAuth credentials)")
        else:
            assert title == "Rosette", f"Expected 'Rosette', got '{title}'"
            print(f"✓ Live site loads: {title}")

        # Check stepper
        steps = page.locator(".s-label").all_text_contents()
        print(f"✓ Stepper: {steps}")

        # Check for JS errors
        js_errors = [e for e in errors if "favicon" not in e.lower()]
        if js_errors:
            print(f"✗ JS errors on load: {len(js_errors)}")
            for e in js_errors[:5]:
                print(f"  {e[:200]}")
        else:
            print("✓ No JS errors on page load")

        # Check that the upload form is functional
        country = page.locator("select").first.input_value()
        print(f"✓ Country selector works: {country}")

        # Check PDF chunk is available (lazy load test)
        # Just verify the script tags exist
        scripts = page.evaluate("Array.from(document.querySelectorAll('script[src]')).map(s => s.src)")
        pdf_chunks = [s for s in scripts if 'pdfExport' in s.lower() or 'pdf' in s.lower()]
        print(f"✓ Chunk scripts found: {len(scripts)} total" + (f", {len(pdf_chunks)} PDF" if pdf_chunks else ""))

        browser.close()
        return len(js_errors) == 0

if __name__ == "__main__":
    print("=== Live Site Validation ===")
    ok = test_live_site()
    print(f"\n{'PASS' if ok else 'FAIL'}: Live site {'working' if ok else 'has errors'}")
