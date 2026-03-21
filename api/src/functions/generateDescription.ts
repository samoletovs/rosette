import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AzureOpenAI } from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";

const COUNTRY_INFO: Record<string, { lang: string; code: string; standards: string; authority: string; voltage: string; socketType: string; tipLocale: string }> = {
  LV: {
    lang: "Latvian", code: "lv",
    standards: "LBN 261-23 'Ēku iekšējās elektroinstalācijas', based on IEC 60364 / HD 60364",
    authority: "Latvijas Būvnormatīvs (Latvian Building Code), overseen by BVKB",
    voltage: "230V AC / 400V three-phase, 50 Hz, TN-C-S or TN-S earthing",
    socketType: "CEE 7/4 Schuko (Type F), 16A, with child-protection shutters per LVS EN 60669",
    tipLocale: "Latvian electricians typically measure socket heights from finished floor to center of socket plate. Distances from water per LBN 261-23 §47."
  },
  LT: {
    lang: "Lithuanian", code: "lt",
    standards: "STR 2.09.02:2005 adapted to IEC 60364 / HD 60364, LST EN 60364 series",
    authority: "Lietuvos statybos techniniai reglamentai (Lithuanian Construction Technical Regulations)",
    voltage: "230V AC / 400V three-phase, 50 Hz, TN-C-S or TN-S earthing",
    socketType: "CEE 7/4 Schuko (Type F), 16A, with child-protection shutters per LST EN 60669",
    tipLocale: "Lithuanian practice follows the unified CENELEC/HD 60364 framework. Socket heights measured to center of mounting box."
  },
  EE: {
    lang: "Estonian", code: "ee",
    standards: "EVS-HD 60364 series (Estonian adoption of HD 60364)",
    authority: "Eesti Standardikeskus (Estonian Centre for Standardisation), building code Ehitusseadustik",
    voltage: "230V AC / 400V three-phase, 50 Hz, TN-C-S or TN-S earthing",
    socketType: "CEE 7/4 Schuko (Type F), 16A, with child-protection shutters per EVS-EN 60669",
    tipLocale: "Estonian installations follow the Nordic practice with emphasis on RCD protection. All new installations require Type A RCDs per EVS-HD 60364-5-53."
  },
};

app.http("generate-description", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate-description",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { rooms: any[]; placements: any; countryCode: string; propertyType: string };
      const cc = body.countryCode || "LV";
      const info = COUNTRY_INFO[cc] || COUNTRY_INFO.LV;
      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-08-01-preview", deployment });

      const roomsClean = body.rooms.map((r: any) => ({
        id: r.id, type: r.type, name: r.name,
        area_m2: r.area_m2, width_m: r.width_m, height_m: r.height_m,
        features: r.features, requested_sockets: r.requested_sockets,
      }));
      const placementsClean = {
        placements: (body.placements.placements || []).map((p: any) => ({
          socket_id: p.socket_id, room_id: p.room_id, room_name: p.room_name,
          wall: p.wall, height_mm: p.height_mm, type: p.type, circuit: p.circuit, notes: p.notes,
        })),
        circuits: body.placements.circuits || [],
        total_sockets: body.placements.total_sockets,
        total_circuits: body.placements.total_circuits,
      };

      const specPrompt = `You are a certified master electrician creating a professional electrical installation specification document. This document will be used by both licensed electricians AND homeowners.

COUNTRY-SPECIFIC CONTEXT:
- Country: ${cc}
- Applicable standard: ${info.standards}
- Regulatory authority: ${info.authority}
- Power supply: ${info.voltage}
- Socket type: ${info.socketType}
- Local practice note: ${info.tipLocale}

DOCUMENT FORMAT — use this EXACT structure with proper Markdown:

# Electrical Installation Specification
**Property type:** ${body.propertyType} | **Standard:** ${info.standards} | **Date:** [current date]

---

## 1. Project Overview
Brief description of the property, total area, number of rooms.
- **Total sockets:** X
- **Total circuits:** X  
- **Power supply:** ${info.voltage}
- **Socket type:** ${info.socketType}
- **Applicable standard:** ${info.standards}

## 2. Room-by-Room Specification

For EACH room, use this exact format:

### 2.X. [Room Name] — [area] m² ([width] × [height] m)

**Room features:** doors, windows, water sources  
**Number of sockets:** X

For each socket, create a structured entry:

| # | ID | Location | Height | Type | Circuit | Purpose |
|---|-----|----------|--------|------|---------|---------|
| 1 | S1 | North wall, 200mm right of entrance door | 300mm | Standard 16A | C1 | General use |
| 2 | S2 | East wall, above countertop, centered | 1100mm | Standard 16A | C1 | Countertop appliances |

Use PRACTICAL location descriptions that reference:
- Door positions ("300mm left of kitchen door")
- Windows ("centered below east window")
- Fixtures ("above countertop, between stove and sink, min 600mm from water")
- Furniture positions ("at bedside table position, left side")
- Wall landmarks ("corner of north and east walls, 200mm from corner")

NEVER use percentage coordinates or abstract positions.

**Special notes for this room:** (e.g., "Refrigerator socket on dedicated circuit", "All sockets min 600mm from sink per ${info.standards}")

## 3. Circuit Schedule

| Circuit | Room(s) | Breaker | Cable | RCD | Sockets | Load Est. |
|---------|---------|---------|-------|-----|---------|-----------|
| C1 | Kitchen | 16A MCB Type B | 3×2.5mm² NYM-J | 30mA Type A | S1-S6 | ~3.5kW |

## 4. Distribution Board Layout
List the recommended order of circuits in the consumer unit/distribution board.

## 5. Material List

| Item | Specification | Quantity |
|------|--------------|----------|
| Socket outlets | ${info.socketType} | X |
| MCB 16A Type B | Per ${info.standards} | X |

## 6. Safety & Compliance

### Bathroom Zones (per IEC 60364-7-701)
Explain zones 0, 1, 2 and what's allowed in each.

### RCD Protection
All socket circuits protected by 30mA RCD. Explain Type A vs Type AC.

### Earthing & Bonding
Equipotential bonding requirements for bathroom, kitchen.

### Applicable Standards Reference
- ${info.standards}
- IEC 60364-7-701 (Bathroom installations)
- IEC 60364-5-52 (Wiring systems)

## 7. User Guide (for Homeowners)
Write 5-8 practical tips in simple language:
- How to identify which circuit a socket belongs to
- When to call an electrician vs DIY
- Signs of electrical problems
- How to test RCD monthly
- Tips for energy efficiency with socket placement

---
*This specification was generated by Rosette — Electric Socket Planner. Always verify with a licensed electrician before installation.*`;

      const [enResponse, localResponse] = await Promise.all([
        client.chat.completions.create({
          model: deployment,
          messages: [
            { role: "system", content: `${specPrompt}\n\nWrite in English.` },
            { role: "user", content: `Generate the specification.\n\nRooms:\n${JSON.stringify(roomsClean, null, 2)}\n\nPlacements:\n${JSON.stringify(placementsClean, null, 2)}` },
          ],
          max_tokens: 4096,
          temperature: 0.15,
        }),
        client.chat.completions.create({
          model: deployment,
          messages: [
            { role: "system", content: `${specPrompt}\n\nWrite the ENTIRE document in ${info.lang}. ALL text, headings, labels, table headers, descriptions, tips — everything must be in ${info.lang}. Keep the same structure and detail level.` },
            { role: "user", content: `Generate the specification in ${info.lang}.\n\nRooms:\n${JSON.stringify(roomsClean, null, 2)}\n\nPlacements:\n${JSON.stringify(placementsClean, null, 2)}` },
          ],
          max_tokens: 4096,
          temperature: 0.15,
        }),
      ]);

      return {
        status: 200,
        jsonBody: {
          description_en: enResponse.choices[0]?.message?.content || "",
          description_local: localResponse.choices[0]?.message?.content || "",
          language: { name: info.lang, code: info.code },
        },
      };
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Description generation failed" } };
    }
  },
});
