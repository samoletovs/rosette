# rosette

rosette is an experimental electrical-socket planner for Baltic residential
properties.

## Research question

rosette tests the NauroLabs question **"Where's the AI-human boundary?"** It
asks whether vision analysis plus country-specific rules can automate the first
planning pass normally performed by a licensed professional, while leaving
verification and installation to qualified people.

## What it does

- Accepts a floor-plan image and identifies rooms, doors, and walls.
- Applies encoded Latvian, Lithuanian, or Estonian placement guidance.
- Generates an SVG placement and circuit diagram.
- Exports plans and collects product feedback.

Generated plans are preliminary planning aids. They do not replace a licensed
electrician or site-specific compliance review.

## Stack

- React 19, TypeScript, and Vite
- Azure Functions (Node.js 20)
- Azure OpenAI vision and text models
- Azure Blob Storage and Table Storage
- Azure Static Web Apps

## Run locally

```powershell
npm install
Copy-Item .env.example .env
Push-Location api
npm install
npm run build
Pop-Location
npm run dev
```

Before submitting a change:

```powershell
npm run lint
npm test
npm run build
```

## Status

**Active research experiment.** Floor-plan analysis, standards lookup,
placement generation, export, feedback, and rate-limiting foundations are
implemented. Outputs still require professional review.

## License

MIT
