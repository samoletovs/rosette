# Measured baseline defects and the next candidate

## Exact baseline

Source: `cff8acdd38608612c3f84bb2b4d0fc46ba2363c4`.
The parent verified [manual CI run 35593290677](https://github.com/samoletovs/rosette/actions/runs/35593290677):
8 gate tests, lint/types, 112 Vitest tests in both dependency layouts, and
frontend/API builds passed; deployment was skipped. The SHA-marked artifact's
real mocked desktop/mobile journeys, retries and exports also passed.

Those results did **not** satisfy the loading budget. The baseline must not be
described as a complete design/performance pass.

## Initial-load dependency defect

Reading the exact built entry and its static imports at the local artifact
server showed:

| Eager JavaScript resource | Uncompressed body bytes |
|---|---:|
| index-B7yQ30TF.js | 253,503 |
| rolldown-runtime-hePW80VL.js | 716 |
| markdown-D6OI01z4.js | 161,933 |
| pdf-DYi0mHp9.js | 686,298 |
| **Initial JavaScript total** | **1,102,450** |

The entry statically imports React/runtime exports from `markdown-*` and the
shared Vite dynamic-import preload helper from `pdf-*`. The package-oriented
`manualChunks` callback grouped shared dependencies into those feature chunks.
Their wrappers were lazy, but the resulting **848,231 bytes** of markdown/PDF
chunks were already fetched before analysis. This is a dependency-boundary
problem, not simply an unnecessary `<link>` in the HTML.

The candidate removes the manual grouping and lets the bundler retain automatic
shared/deferred boundaries. Markdown rendering has one explicit lazy component
entry; placement and PDF export retain their existing dynamic entry points.
No preload suppression, dependency change, or budget relaxation is introduced.

A build-only plugin emits `lazy-chunks.json` from actual module IDs and chunk
facades, identifying each feature entry and chunks carrying its primary
libraries. It also rejects any such chunk in a static entry's eager import
closure, so the original dependency-placement failure becomes a build failure
without an extra CI service. The browser runner additionally rejects those chunks before their feature's
phase: all three before analysis/placement; markdown/PDF before results; PDF
before export. It also requires the feature entry to load and the existing
interaction/export to work when requested. This checks vendor chunks as well
as wrappers, rather than relying on convenient output filenames.

Four unit checks cover the loading assertions. Applying the new assertion to
the baseline's recorded pre-analysis resources also rejected both offending
vendor chunks, even though the PDF export wrapper was still deferred.

New-source byte counts and a full phase-loading pass remain **unmeasured until
the parent builds and captures the next exact candidate**.

### Recoverable formatter loading

The new lazy specification import now catches its own import/preload rejection
and resolves to a lightweight, already-available plain-text view. It explicitly
says that formatted specification loading failed; it does not report formatting
success or reset the surrounding results. The original returned text, language
switching, diagrams and downloads remain available. This is scoped to loading
the formatter, not a global render-error boundary or a backend behavior change.

The production browser runner deliberately aborts the build's real Markdown
entry chunk at desktop and mobile widths, then checks retained plan data,
plain specification text, language switching and downloads. Only those
deliberate failed requests are allowed; unhandled page errors remain failures.
Normal journeys additionally require actual Markdown headings and no fallback.
These new cases await the same next exact-source build/capture, not a separate
validation cycle or a fabricated pass receipt.

## Contrast and 200% text measurements

Fresh local Chromium contexts measured six real baseline states at both
1440px and 390px: upload, analysis error, room review, active placement, results,
and the paywall. Fixtures were synthetic; no live authentication or user plan
was used.

See [`baseline-cff8acd-accessibility.json`](baseline-cff8acd-accessibility.json).

- Normal measured HTML text was at least **5.01:1**, except one actual defect:
  the active room placement button retained paper-colored text when its hover
  background became sage, giving **1.20:1** at both widths.
- At **200% root text size (32px)**, mobile room review overflowed horizontally:
  the heading's min-content width expanded its grid track. The other measured
  states did not overflow.
- Control-border tokens measured **3.24:1–3.88:1**, and focus tokens
  **6.28:1–7.53:1**, against the three declared surfaces.

The candidate keeps the active hovered button dark and prevents the editorial
heading from forcing a wider grid track. Both conditions are now exercised by
the normal browser regression runner, including active hover and 200% text in
each state at each viewport.

### Deliberately limited CSS diagnostic

[`diagnostic-cff8acd-with-candidate-css.json`](diagnostic-cff8acd-with-candidate-css.json)
records a separate isolation experiment: the original `cff8acd` HTML/JavaScript
with **only the candidate stylesheet injected locally**. The injected stylesheet
digest is recorded in that JSON. All 12 measured combinations then had no HTML
contrast failures (minimum **5.01:1**) and no 200% text overflow.

That experiment verifies the CSS corrections against the existing DOM. **It is
not a rebuilt-candidate browser pass, loading-performance pass, independent
review, or design receipt.** The next exact compiled artifact must be retested.
The `diagnostic-*` PNG is labelled accordingly; baseline PNGs show the defects.

The measurements cover visible HTML text, native values and placeholders;
inactive controls and SVG/canvas/image text are excluded. Text enlargement is
not browser zoom. Generated diagrams, physical devices, browser zoom, and
assistive-technology/visual checks still require the independent review's stated
scope. No WCAG conformance certificate or field Core Web Vitals result is claimed.

## Scaffold branding, in the same validation batch

The application favicon now uses `public/rosette.svg`: the original approved
socket mark, with the existing olive/plaster palette and a light backing for
legibility in browser tabs. The app-header mark, document title, charset and
viewport metadata are preserved. No external asset or font was downloaded.

The unit checks compare the favicon geometry to the existing app mark. The
same production browser runner also checks the title, icon link and served SVG,
so the parent can validate this together with loading, contrast and enlargement
on the latest combined source—not in a separate favicon-only CI cycle.
