# Planning Studio verification

## Exact compiled source

Source: `7ff33b687e380fbd94b831bf104c285d8da18845`.
[Quality-only CI run 35604154294](https://github.com/samoletovs/rosette/actions/runs/35604154294)
restored the unchanged lockfiles and passed lint, type checking, 116 Vitest tests
in both root-only and API-installed layouts, 11 Git-based design-gate tests, and
frontend/API builds. Both deployment jobs were skipped. Four loading-assertion
unit tests also passed locally.

The local package feed could not supply the exact locked Vitest version, and
offline restore confirmed a missing cache entry. No dependency was downgraded
and no package feed was changed. The source-stamped CI artifact was downloaded
and served on loopback for the real-application browser tests.

## Actual application evidence

[`actual-7ff33b6/browser-results.json`](actual-7ff33b6/browser-results.json)
records the healthy and deliberately failed-chunk journeys. Captures and
synthetic SVG, Markdown and PDF exports are in the same directory.

- Desktop 1440px and mobile 390px: keyboard-operated visible upload control,
  analysis and calculation failure/retry, retained room/placement data, room
  editing, empty-state recovery, country/language behavior and exports passed.
- Placement, Markdown and PDF chunks stayed deferred until their actual feature
  phase, then loaded and worked. Initial decoded JavaScript fell from
  **1,102,450 to 263,983 bytes (76.05% less)**. This is a payload measurement,
  not a claim of equivalent task-time or field Core Web Vitals improvement.
- Thirteen measured state/viewport combinations, including active hover and the
  formatter-failure state, had zero measured HTML text-contrast failures.
  Minimum measured text contrast was **5.01:1**; control-border token ratios
  were at least **3.24:1** and focus token ratios at least **6.28:1**.
- All recorded 200% root-text checks had no page-wide horizontal overflow.
- Aborting the real Markdown entry chunk at both widths preserved the completed
  plan, original plain specification, language switching and SVG/Markdown
  downloads, with explicit failure feedback and no unhandled page errors.

True browser zoom was checked separately, not inferred from text enlargement:
[`browser-zoom-results.json`](actual-7ff33b6/browser-zoom-results.json) records
native Chromium `chrome.tabs.setZoom(2)` in a fresh temporary test profile.
The viewport changed from 1422 to 711 CSS pixels and DPR from 1 to 2. Keyboard
upload and the primary journey completed, with no page-wide horizontal overflow
in upload, review, placement or results. The `browser-zoom200-*` captures show
those four phases. No existing browser profile or user authentication was used.

## Review status

Independent source review by `design-foundation-review`
(`fceff45a-bc89-4923-8781-5ab1951f0540`) found the PR-head/merge-tree mismatch;
it was fixed and reviewed in `809dab2`. The final chunk-failure recovery delta
`7ff33b6` was also reviewed with no significant issues. The reviewer subsequently
inspected representative final normal, recovery, formatter-failure and all four
native-zoom captures, the stamped reports and the native-zoom probe method.
Final disposition: **no significant issues found; no outstanding findings in
the reviewed scope**. Execution was performed by the parent, not independently
rerun by the reviewer. The source-bound [receipt](review.json) records this
scoped approval, not a certification of the untested areas below.

## Scope and limits

All backend responses and floor plans used for these browser checks are clearly
synthetic. This verifies the compiled frontend against API-shaped fixtures, not
live authentication, payment or production-service behavior. Tests use Chromium;
physical devices, other browser engines and screen-reader testing were not
performed. SVG/canvas/image text is not covered by the automatic HTML contrast
measurement. No WCAG conformance certificate or Lighthouse/field metric is claimed.

## Original direction-choice evidence

The four `concept-*.png` files were captured during the original two-direction
exploration on 2026-09-21 using the shared fictional apartment. The owner chose
A later that day. They are copied unchanged from the session's preview artifacts.
They demonstrate the choice, not the real application's implementation.

The concept source at `5b02c066f71cb46f88acb8913a923865342d8365` received a read-only
independent source review from the same reviewer with no significant findings.
That review was not evidence for the later production implementation.

| Artifact | SHA-256 |
|---|---|
| concept-a-desktop.png | f35a29360c5dac03366809b3ab6b414ee1a4374fa371f671218cdaf2f9a3fab1 |
| concept-a-mobile.png | 51deca3403a65640f7af7f6c2d15da7931cafe303b841b16782fb3d757b2af7b |
| concept-b-desktop.png | 41e33674019eda180aa36dcd46f6eede007a381fbc1c5c19ebaff7df5f706b2c |
| concept-b-mobile.png | 359ced5fe9bd4ffd06e64e670836b965223672ca5ba88699eb666bd80e4bf1f5 |

The measured baseline defects and deliberately limited CSS isolation experiment
remain documented in
[performance-and-accessibility.md](performance-and-accessibility.md). They are
history, not substitutes for the final compiled-source checks.
