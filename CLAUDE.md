# rosette — Claude Code Instructions

## Project Overview

Rosette is an AI-assisted electrical socket planning tool for Baltic properties.

## Architecture

- `src/` — planner UI and core interaction logic
- `api/` — backend AI and compute functions
- `tests/` — frontend and API tests
- `infrastructure/` — Bicep deployment definitions

## Key Rules

- Keep planner behavior predictable and test-covered.
- Preserve accessibility and keyboard interaction patterns.
- Prefer configuration through environment variables.

## Validation

- `npm run lint`
- `npm run build`
- `npm run test`
