# Planning-studio pilot: implementation held

The owner chose direction A on 2026-09-21. The canonical approved brief is
[`.impeccable.md`](../../.impeccable.md). The earlier standalone concepts remain
unchanged as exploration history.

## Dependency blocker — 2026-09-21

The exact isolated checkout cannot currently restore its declared lockfile:

- Baseline `npm run build` failed because `tsc` was not installed.
- `npm ci --no-audit --no-fund` failed with **E404** for the locked
  `vitest-5.0.1.tgz` at the configured `packagefeedproxy.microsoft.io` npm feed.
- An offline dry run listed metadata but did not prove package availability.
- Actual `npm ci --offline --no-audit --no-fund --loglevel=error` failed with
  **ENOTCACHED** for the same locked artifact.
- The original checkout has different versions (Vitest 4.1.10, Vite 8.2.1,
  React 19.2.8). These do not satisfy this checkout's declared versions and were
  not substituted.

No dependency was downgraded, lockfile changed, registry switched, or security
restriction bypassed. No Python package download was attempted.

## Checkpoint scope

The brief records the actual owner choice. Initial, **unintegrated and unverified**
`PlanUpload`, `Dialog`, and file-validation helpers preserve the implementation
draft. `App.tsx`, production styles, APIs, models, electrical calculations,
authentication, storage, infrastructure, and deployment workflows are unchanged.
The new helpers are not imported by the application. This checkpoint is not a
completed redesign and must not become a mergeable PR.

## Resume and evidence

Resume when the exact declared dependencies are available from the approved
source/cache, or after an explicit separately reviewed dependency decision.

Then integrate A into the existing journey, extend requirement tests, run the
existing build/lint/Vitest, and commit source before recording synthetic-data
browser evidence. Capture actual app PNGs under `planning-studio/`; label copied
concept images as owner-choice history, not application screenshots.

The reviewed shared `design-gate.py` still needs a pinned project copy and
integration into the existing quality job **on relevant pull requests only**,
with sufficient Git history. Backend-only PRs should not require a fresh visual
receipt. Do not run source-ancestry validation unconditionally after squash on
`main`. Test missing/stale receipt failures, not just a successful receipt.

Only after the parent coordinates independent review should `review.json` name
the real reviewer and actual results. No implementation screenshot, review
receipt, performance pass, or CI-adoption claim exists at this held checkpoint.
