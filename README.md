# rosette

> AI-powered electrical socket planner for Baltic properties — upload a floor plan image, get a placement diagram.

Live at **[rosette.naurolabs.com](https://rosette.naurolabs.com)**

---

## What it does

1. **Upload** a photo or scan of your floor plan
2. **Analyse** — GPT-4o vision reads the rooms, doors, and walls
3. **Calculate** — placement engine applies the correct national standard (Latvia LBN 261-23, Lithuania STR 2.09.02:2005, Estonia EVS-HD 60364)
4. **Export** — download a dimensioned circuit diagram as PDF

The tool is opinionated: it targets Baltic residential properties and generates compliant layouts, not generic suggestions.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Azure SWA |
| Backend | Azure Functions (Node.js 20, TypeScript) |
| AI | Azure OpenAI GPT-4o (vision + text) |
| Storage | Azure Blob Storage (uploads), Table Storage (feedback) |
| Auth | Google OAuth via SWA built-in |

## Development

```bash
# Frontend
npm install
npm run dev          # http://localhost:5173

# API (in /api)
cd api
npm install
npm run start        # http://localhost:7071
```

Copy `.env.example` → `.env` and fill in your Azure credentials before running the API.

## Architecture

```
rosette/
├── src/                    # React frontend
│   ├── App.tsx             # Multi-step wizard
│   ├── planGenerator.ts    # SVG circuit diagram renderer
│   └── symbolLibrary.ts    # Electrical symbol definitions
├── api/                    # Azure Functions
│   └── src/functions/
│       ├── analyze.ts      # GPT-4o vision endpoint
│       ├── calculate.ts    # Socket placement engine
│       └── standards.ts    # Country electrical standards API
└── standards/              # Source standards in Markdown
    ├── lv.md               # Latvia — LBN 261-23
    ├── lt.md               # Lithuania — STR 2.09.02:2005
    └── ee.md               # Estonia — EVS-HD 60364
```

## Cost & rate limiting

Each analysis call uses GPT-4o vision. A per-IP rate limit (configurable via `ROSETTE_RATE_LIMIT_PER_MIN`) prevents runaway usage. Budget caps are enforced in the API layer.

## Status

Research experiment under [NauroLabs](https://naurolabs.com). Active.

## License

MIT — see [LICENSE](LICENSE).
