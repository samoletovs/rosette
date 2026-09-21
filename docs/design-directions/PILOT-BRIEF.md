# Rosette: two visual directions

**Status: CONCEPT EXPLORATION — neither direction is approved.**

## Confirmed brief

- **Audience:** homeowners planning a renovation; an electrician reviews the result.
- **Job:** make the home and its everyday needs understandable before discussing electrical decisions.
- **Shared craft:** clear next steps, accessible interaction, honest states, responsive layouts, and visible safety boundaries. Product personality need not match other NauroLabs products.
- **Approval gate:** the user chooses A, B, or revisions before production implementation. This document is not a selected identity or a new production design system.

## Two proposals

| | A — The planning studio | B — The spatial workbench |
|---|---|---|
| Character | Considered, domestic, conversational | Precise, spatial, approachable |
| Composition | Editorial introduction; room index above a paper-like drawing; unboxed room notes alongside | Compact project header; room navigator, plan canvas, and inspector in one workspace |
| Signature | A renovation notebook with an architectural drawing at its centre | The selected room connects the navigator, highlighted plan, and details panel |
| Palette | Plaster `#f4f0e7`, paper `#fffdf8`, walnut `#302f28`, olive `#4e603b`, sage `#e6ebd8`, stone `#666255` | Mist `#eef2f7`, porcelain `#fcfdff`, ink `#172c46`, cobalt `#244fd1`, pale blue `#e2eaff`, slate `#50617a` |
| Type | Georgia display; Segoe UI/Tahoma body | Trebuchet MS display; Segoe UI/Tahoma body |
| Mobile | Drawing → readable room buttons → room details → next action | Same task order, with navigator reflowed into a touch-friendly grid |

Fonts are locally available browser fallbacks: no font files copied, no external font service, no licensing dependency added. The visual contrast is composition and typography, not just recolouring. Local fallback metrics can vary across systems.

## Scope and interaction

Open `index.html`, `studio.html`, or `workbench.html` in a browser, directly from disk or through a static loopback server. No build/install is required.

Both directions use one original synthetic 64 m² apartment: living room 24 m², kitchen 12 m², bedroom 16 m², bathroom 6 m², hallway 6 m². Shapes are illustrative, not measured drawings. Both start with three rooms reviewed and share the primary action **Preview review pack**.

Working demonstration interactions:

- Select any room on the drawing or through native room buttons.
- Adjust household routines and add a fictional note; changed details reopen that room’s review.
- Mark/reopen room review and see the progress count update.
- Preview a room-by-room summary, including incomplete review states and notes; return without losing this tab’s changes.
- Open sample-plan information; move between the two concepts.

No account, upload, network API, analytics, payment, storage, export, AI analysis, or calculation exists here. Reloading resets everything. The summary uses text nodes for typed notes. Content Security Policy blocks connections and external resources.

## Relationship to the current product

Read `AGENTS.md`, `src/App.tsx`, and `src/index.css`: the current app moves from upload/analysis to room review, placement editing, calculation, and diagram/specification results. These concepts explore **room review and homeowner-to-electrician handoff**, not a replacement implementation of that flow. Calculation, placement editing, standards verification, and PDF output are intentionally not simulated.

Every concept labels itself sample/demo and a planning aid for electrician review, **not an approved electrical design**. There are no electrical wiring instructions, socket positions, or claims of compliance.

## Decision to make

Which direction makes a homeowner more confident about reviewing their home: the spacious planning studio or the plan-first workbench? What should be retained or revised? Only after that choice should the production flow, implementation plan, and detailed design tokens be developed.

## Validation boundary

Chromium checks on 2026-09-21 covered both concepts at 1440 px and 390 px: selection, notes, preference changes, partial/complete review packs, reopening reviews, progress updates, keyboard Enter/Space, skip navigation, focus restoration, and reload reset. Typed markup remains literal text. No browser errors or external requests were observed.

Widths 320, 390, 760, 768, 1024, 1440, and 1920 px had no horizontal overflow; all plan-room targets were at least 54 px. Measured visible text contrast was at least 5.01:1 (A) / 5.24:1 (B); control borders at least 3.24:1 / 3.22:1 against the tested surfaces. Reduced-motion mode had no running animation. JavaScript syntax, whitespace, and editor diagnostics checks passed.

Browser validation evidence and desktop/mobile screenshots accompany the session handoff, outside the repository. This is not a full WCAG certification, an electrician’s review, or a physical-device/cross-browser study. Production code, configuration, dependencies, and deployment remain untouched.
