# Planning-studio pilot: validation and review

The owner chose **A — Planning studio** on 2026-09-21. The canonical brief is
[`.impeccable.md`](../../.impeccable.md). The original two standalone concepts
remain unchanged as exploration history. Their copied PNGs under
`planning-studio/` are labelled `concept-*`; **they are not screenshots of the
production implementation**.

## Implementation scope

The candidate applies the selected warm architectural identity to the existing
upload, analysis, room review, placement, calculation, results, and export flow.
It adds visible native keyboard upload, file validation, readable mobile controls,
real waiting/error states, retained placement on calculation failure, keyboard
placement controls, and native modal focus handling.

No API, model, electrical calculation/standards rule, authentication provider,
backend storage, infrastructure, payment mechanism, or deployment target changed.
The concept's routines/notes are not invented backend features. Existing PDF
input remains accepted for analysis, but the existing placement renderer needs
an image; the UI now explains an unavailable preview rather than spinning forever.
The existing Stripe placeholder is not a working payment integration, and this
pilot does not claim to validate a purchase.

## Local dependency limitation

On 2026-09-21 baseline `npm run build` failed because `tsc` was absent. Exact
`npm ci --no-audit --no-fund` then returned **E404** for locked
`vitest-5.0.1.tgz` at the configured `packagefeedproxy.microsoft.io` feed.
Actual `npm ci --offline --no-audit --no-fund --loglevel=error` returned
**ENOTCACHED**. The offline dry run only listed metadata, not installed packages.

The original checkout's Vitest 4.1.10, Vite 8.2.1, and React 19.2.8 were not
substituted for the declared versions. No registry, manifest, or lockfile was
changed. No Python package download was attempted.

This limits **local** full build/lint/Vitest/browser validation, not the ability
to use GitHub's existing validation infrastructure. Syntax-only checking with an
already available exact-version TypeScript 6.0.3 compiler is not a project build
or type-check pass.

## Existing CI job and remote validation

The existing quality job now:

1. Fetches full history and checks the exact event SHA, also explicitly used by
   deployment. On PRs this is the synthetic merge, so quality, evidence and the
   preview deployment cover the same tree.
2. Runs the offline gate regression suite.
3. On **pull requests only**, detects changed `src/`, `public/`, entry/config/
   dependency/brief files and gate code, then requires a current receipt.
4. Keeps the existing lint, TypeScript, and Vitest/coverage checks.

Backend-only changes under `api/` do not require visual evidence. UI additions,
edits, deletions, missing Git history, missing receipts, and stale receipts are
not silently skipped. PR evidence-only updates trigger CI again. Pushes to `main`
do not run source-ancestry validation, since squash merging changes ancestry.

A synthetic PR merge retains the reviewed branch commit as an ancestor. It
passes only when its non-evidence tree still matches that reviewed source.
Non-conflicting base-branch drift on a UI PR therefore blocks stale evidence
before preview deployment. Update the isolated task branch with the current
base and repeat capture/review; do not merely substitute a SHA in the receipt.
Backend-only PRs still need no new visual receipt for inherited base UI changes.

For a held branch, the existing workflow's manual dispatch runs quality
validation **without deployment**. Its manual build records
`dist/source-revision.txt` and uploads `rosette-preview-<exact SHA>` after the
existing quality checks and frontend/API builds succeed. **An artifact does not
certify independent review or merge readiness.**

The API-test/module-resolution fix from PR #26 was merged by its owner as
`7632f73c2c5eed18c689326a57636d6c1918f6d5`, then integrated from `origin/main`
into this isolated pilot. Its mocks, Vitest configuration, API dependency checks,
manual-build behavior, and separate manual concurrency group are preserved.
The pilot adds only PR evidence enforcement and a source-stamped preview artifact.

## Gate provenance and local regression tests

`scripts/design-gate.py` is the reviewed shared implementation pinned to
`samoletovs/nauroLabs-github` merge
`8303fd429a2907834881733ce77ee7a371a431ca` (PR #287). Its provenance is recorded in
`scripts/design-gate.origin.json`; project-specific PR scoping is separate.

```powershell
python tests\test_design_gate.py
python scripts\check-design-pr.py --repo . --base <full-PR-base-SHA>
```

Eleven offline regression tests exercise the actual entry point: missing
evidence, backend-only scope, evidence-only commits, stale committed source,
concealed staged source, modified PNGs, missing history, deleted UI files, and
three synthetic-merge/base-drift cases.
The generated PNGs are test fixtures inside `.test-artifacts/`, never claimed
as rendered product evidence.

## Browser verification after a successful remote build

Use the existing Python Playwright installation; no new test framework is
required. Download the exact-SHA artifact into this project's ignored `dist/`.
Serve it on loopback using an attached process:

```powershell
python -m http.server 4178 --bind 127.0.0.1 --directory dist
```

In another attached shell, run:

```powershell
python tests\test_planning_studio.py --url http://127.0.0.1:4178
```

The runner launches only new local browser contexts. It exercises the real
visible upload button with Enter/Space and a file-chooser event, not just a
hidden-input shortcut. API-shaped synthetic fixtures cover failed analysis,
empty analysis/review, retained file/room/placement data, calculation retry,
long room names, all diagram views, local-language specification, SVG/Markdown
downloads, the actual PDF exporter in a simulated already-unlocked state, and
paywall Escape behavior. No purchase or real service call occurs.

Separate desktop/mobile cases abort the actual Markdown-renderer entry chunk from
the build report. They require an explicit formatting-failure notice, retained
room/socket totals and edited counts, readable original specification text in
both languages, and working specification/SVG downloads without recalculation
or unhandled page errors. Healthy journeys require real rendered Markdown
headings and reject the fallback, so graceful degradation cannot masquerade as
successful formatting.

It checks multiple widths, 200% **text enlargement** in each representative
state (not claimed as browser zoom), measured HTML/form/placeholder contrast,
active placement hover, reduced motion, and unexpected external requests.
SVG/canvas/image text and broader visual/assistive-technology checks remain in
the manual review scope.

The build emits a module-based `lazy-chunks.json`. The runner requires placement,
markdown and PDF code to remain absent before their respective phases, then
requires the requested feature to load and work. Vendor chunks count, not just
lazy wrappers. `browser-results.json` records initial uncompressed JavaScript
bytes, phase observations and actual local resource timings—not field Core Web
Vitals. The four loading-assertion unit tests can also run with the existing
Playwright environment:

```powershell
python tests\test_browser_requirements.py
```

After committing all source/documentation fixes, capture evidence using the
exact served build marker and matching checkout:

```powershell
python tests\test_planning_studio.py --url http://127.0.0.1:4178 `
  --source <full-source-SHA> --output docs\design-evidence\planning-studio
python scripts\design-gate.py --repo . --brief-hash <full-source-SHA>
```

Coordinate independent review with the parent. Only then write `review.json`
with the real reviewer, actual checks, canonical Git brief hash, and hashed
desktop/mobile PNGs. Copy the two `concept-*-desktop.png` artifacts into the
new-direction option entries and cite the actual owner choice. Commit evidence
after source; run the gate again immediately before delivery.

The parent verified the `cff8acd` quality build and browser journeys, then found
real loading and accessibility failures; see
[`planning-studio/performance-and-accessibility.md`](planning-studio/performance-and-accessibility.md).
Those baseline results are not a pass for the revised source. Until its checks
and independent review are complete, no latest-source performance pass or
ready-to-merge receipt is claimed.
