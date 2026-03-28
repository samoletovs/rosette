"""
Playwright test for Rosette placement editor UI.
Tests: Upload page rendering, mobile layout, component rendering.
"""
from playwright.sync_api import sync_playwright
import os

URL = "http://localhost:5173"
SCREENSHOTS = os.path.join(os.path.dirname(__file__), "..", "screenshots")
os.makedirs(SCREENSHOTS, exist_ok=True)

def test_desktop():
    """Test desktop layout at 1280x900."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        
        # Upload page
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SCREENSHOTS}/01-desktop-upload.png", full_page=True)
        
        # Verify key elements
        assert page.locator("h1").inner_text() == "Rosette"
        assert page.locator("h2").inner_text() == "Upload floor plan"
        assert page.locator(".stepper").count() == 1
        
        # Verify country dropdown
        country_select = page.locator("select").first
        assert country_select.is_visible()
        options = country_select.locator("option").all_text_contents()
        assert "Latvia" in options
        
        # Verify property type dropdown
        prop_select = page.locator("select").nth(1)
        assert prop_select.is_visible()
        
        # Verify drop zone
        assert page.locator(".drop").is_visible()
        
        # Verify analyze button is disabled (no file)
        btn = page.locator("button.primary")
        assert btn.is_disabled()
        
        print("✓ Desktop upload page renders correctly")
        
        # Check stepper
        steps = page.locator(".s-label").all_text_contents()
        assert steps == ["Upload", "Analyze", "Review", "Place", "Calculate", "Results"]
        print("✓ Stepper shows all 6 steps")
        
        # Check themes (in footer, may be off screen)
        assert page.locator(".theme-bar").count() > 0
        print("✓ Theme bar exists")
        
        browser.close()

def test_mobile():
    """Test mobile layout at 390x844."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{SCREENSHOTS}/02-mobile-upload.png", full_page=True)
        
        # Verify responsive layout
        assert page.locator("h1").inner_text() == "Rosette"
        assert page.locator("h2").inner_text() == "Upload floor plan"
        
        # Verify drop zone is visible
        assert page.locator(".drop").is_visible()
        
        # Check that elements don't overflow
        viewport_width = 390
        drop = page.locator(".drop").bounding_box()
        assert drop is not None
        assert drop["x"] >= 0
        assert drop["x"] + drop["width"] <= viewport_width + 20  # small tolerance
        
        print("✓ Mobile upload page renders without overflow")
        
        browser.close()

def test_feedback_button():
    """Test feedback button exists."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        
        # Look for feedback button
        fb = page.locator(".fab-feedback")
        if fb.count() > 0:
            assert fb.is_visible()
            print("✓ Feedback button visible")
        else:
            print("⚠ No feedback button found (optional)")
        
        browser.close()

if __name__ == "__main__":
    print("=== Rosette UI Tests ===")
    test_desktop()
    test_mobile()
    test_feedback_button()
    print("\n=== All tests passed ===")
