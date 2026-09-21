"""Unit checks for the browser runner's feature-loading assertions."""
from __future__ import annotations

import unittest

from test_planning_studio import assert_deferred

FEATURES = {
    "placement": {"entry": "assets/placement.js", "chunks": ["assets/placement.js"]},
    "markdown": {"entry": "assets/specification.js", "chunks": ["assets/specification.js", "assets/markdown-vendor.js"]},
    "pdf": {"entry": "assets/export.js", "chunks": ["assets/export.js", "assets/pdf-vendor.js"]},
}


class LazyFeatureRequirements(unittest.TestCase):
    def test_rejects_eager_pdf_vendor_even_without_the_export_wrapper(self) -> None:
        with self.assertRaisesRegex(AssertionError, "pdf code loaded before"):
            assert_deferred({"assets/runtime.js", "assets/pdf-vendor.js"}, FEATURES, "pdf")

    def test_rejects_eager_markdown_vendor_even_without_the_render_wrapper(self) -> None:
        with self.assertRaisesRegex(AssertionError, "markdown code loaded before"):
            assert_deferred({"assets/runtime.js", "assets/markdown-vendor.js"}, FEATURES, "markdown")

    def test_shared_runtime_is_allowed_before_features_are_used(self) -> None:
        assert_deferred({"assets/runtime.js", "assets/main.js"}, FEATURES, "placement", "markdown", "pdf")

    def test_opening_placement_does_not_allow_markdown_or_pdf_yet(self) -> None:
        assert_deferred({"assets/runtime.js", "assets/placement.js"}, FEATURES, "markdown", "pdf")


if __name__ == "__main__":
    unittest.main()
