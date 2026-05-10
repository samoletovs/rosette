# Rosette — AI Electric Socket Planner

## Overview

AI-powered tool for planning electrical socket placement in Baltic properties, using GPT-4o vision for floor plan analysis and country-specific electrical standards (Latvia, Lithuania, Estonia).

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8
- **Backend**: Azure Functions (Node.js 20, TypeScript)
- **AI**: Azure OpenAI GPT-4o (vision + text)
- **Storage**: Azure Blob Storage (uploads), Azure Table Storage (feedback, login tracking)
- **Auth**: Azure SWA built-in Google OAuth
- **Hosting**: Azure Static Web Apps

## Project Structure

```text
rosette/
├── src/                      # React frontend
│   ├── App.tsx               # Multi-step wizard (upload → analyze → calculate)
│   ├── api.ts                # API client with timeout handling
│   ├── planGenerator.ts      # SVG floor plan / circuit diagram generation
│   └── index.css             # Light theme styles
├── api/                      # Azure Functions backend
│   ├── src/functions/
│   │   ├── analyze.ts        # Floor plan analysis via GPT-4o vision
│   │   ├── upload.ts         # File upload to Blob Storage
│   │   ├── calculate.ts      # Socket placement calculation
│   │   ├── generateDescription.ts  # Multi-language descriptions
│   │   ├── standards.ts      # Electrical standards API
│   │   ├── feedback.ts       # Feedback to Table Storage
│   │   └── logLogin.ts       # Login tracking
│   └── src/standardsData.ts  # Auto-generated standards (LV/LT/EE)
├── standards/                # Country electrical standards (Markdown)
│   ├── lv.md                 # Latvia — LBN 261-23
│   ├── lt.md                 # Lithuania — STR 2.09.02:2005
│   └── ee.md                 # Estonia — EVS-HD 60364
└── staticwebapp.config.json  # SWA routing & auth config
```

## Coding Standards

- TypeScript strict mode enabled
- All API functions return proper HTTP status codes (400, 413, 500)
- Input validation: check required fields, enforce size limits
- Use `console.warn` / `console.error` — no `console.log` in production
- Frontend uses timeout wrapper (`withTimeout`) for AI API calls (90s default)
- Git-ignored: `.env`, `dist/`, `api/dist/`, `node_modules/`

## Environment

- Azure subscription: Visual Studio Enterprise
- Azure region: northeurope
- GitHub: samoletovs/rosette (private)
- Push to `main` branch
- Config template: `.env.example`

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite build
npm run lint       # ESLint
npm run format     # Prettier
npm test           # Run tests (pending)
```

## Deployment

- Push to `main` triggers GitHub Actions → Azure SWA deploy
- API builds separately in `api/` folder
- Telegram notification on success/failure
