import type { AzureOpenAI } from "openai";
import { completionOptions } from "./openaiRequest";

export interface CountryInfo {
  lang: string;
  code: string;
  standards: string;
  authority: string;
  voltage: string;
  socketType: string;
  tipLocale: string;
}

export const COUNTRY_INFO: Record<string, CountryInfo> = {
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
export function countryInfo(countryCode: string | undefined): CountryInfo {
  return COUNTRY_INFO[countryCode || "LV"] || COUNTRY_INFO.LV;
}

// The SWA managed API cuts a request off at 45 s, and gpt-6-luna writes about
// 119 tokens/s. One long document therefore cannot be produced in one call, so
// it is written and translated as parallel parts: a request then takes as long
// as its slowest part, not the sum of all of them. The ceiling bounds any one
// call to roughly 34 s on luna.
export const PART_TOKEN_CEILING = 4000;
export const MAX_SOCKETS_PER_ROOM_BATCH = 12;
export const MAX_ROOMS_PER_ROOM_BATCH = 6;
export const MAX_TRANSLATION_CHUNK_CHARS = 3500;

// Azure OpenAI counts each request's prompt plus its token ceiling against the
// deployment's tokens-per-minute quota as the request arrives, and the parts run
// at the same time. So each ceiling is sized to what its part writes, with about
// 2x headroom over measured output, rather than every part reserving the maximum.
const OVERVIEW_TOKENS = 1000; // measured 212
const CLOSING_TOKENS = 2500; // sections 6-8, measured 1,043
const capped = (tokens: number) => Math.min(PART_TOKEN_CEILING, tokens);
// Measured 407-650 for batches of 8-12 sockets in 1-3 rooms.
const roomBatchTokens = (rooms: number, sockets: number) => capped(600 + 250 * rooms + 80 * sockets);
// Measured 1,180 for 6 circuits; each circuit adds a schedule row, a wiring row and a board slot.
const scheduleTokens = (circuits: number) => capped(1000 + 250 * circuits);
// Latvian measured about 0.5 output tokens per English character.
export const translationTokens = (chunk: string) => capped(Math.max(800, Math.ceil(chunk.length * 0.9) + 200));

export interface SpecRoom {
  id?: unknown;
  [key: string]: unknown;
}

export interface SpecPlacements {
  placements: { room_id?: unknown; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface SpecPart {
  scope: string;
  rooms: SpecRoom[];
  placements: SpecPlacements;
  maxTokens: number;
}

export function buildSpecPrompt(cc: string, info: CountryInfo, propertyType: string): string {
  return `You are a certified master electrician creating a professional electrical installation specification document. This document will be used by both licensed electricians AND homeowners.

COUNTRY-SPECIFIC CONTEXT:
- Country: ${cc}
- Applicable standard: ${info.standards}
- Regulatory authority: ${info.authority}
- Power supply: ${info.voltage}
- Socket type: ${info.socketType}
- Local practice note: ${info.tipLocale}

DOCUMENT FORMAT — use this EXACT structure with proper Markdown:

# Electrical Installation Specification
**Property type:** ${propertyType} | **Standard:** ${info.standards} | **Date:** [current date]

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

| # | ID | Location | Height | Type | Gang | Circuit | Purpose |
|---|-----|----------|--------|------|------|---------|---------|
| 1 | S1 | North wall, left section | 300mm | Standard 16A | Single | C1 | General use |
| 2 | S2 | East wall, center section | 1100mm | Standard 16A | Double | C1 | Countertop appliances |

LOCATION DESCRIPTIONS — derive from the provided data:
Each socket has x_pct/y_pct (position on floor plan as percentages) and a wall assignment. Each room has a position bounding box (x_pct, y_pct, w_pct, h_pct). Use this to determine WHERE on the wall the socket sits:
- Calculate the socket's relative position within its room (e.g., socket x_pct relative to room x_pct → left/center/right of that wall)
- Describe as: "[Wall] wall, [left/center/right] section" or "[Wall] wall, near [corner with adjacent wall]"
- For kitchen countertop sockets (height ≥1000mm): add "above countertop level"
- For bedside sockets (height 600mm in bedrooms): add "bedside height"
- If room features mention water sources and socket is nearby: note "min 600mm from water source"
- NEVER invent distances from doors, windows, or furniture — we do not have their exact positions
- NEVER fabricate specific millimeter measurements from landmarks

GANG COLUMN: Show "Single", "Double", "Triple", etc. based on the gang value (1=Single, 2=Double, 3=Triple, 4=Quad, 5+=Multi).

**Special notes for this room:** (e.g., "Refrigerator socket on dedicated circuit", "All sockets min 600mm from sink per ${info.standards}")

## 3. Circuit Schedule

IMPORTANT: Circuits are grouped by RCD. Each RCD (30mA) protects a maximum of 3–4 circuits. Show the grouping clearly.

### RCD 1 — [Group Label, e.g. "Kitchen & Dining"]

| Circuit | Room(s) | Breaker | Cable | Sockets | Load Est. |
|---------|---------|---------|-------|---------|-----------|
| C1 | Kitchen | 16A MCB Type B | 3×2.5mm² NYM-J | S1-S6 | ~3.5kW |

### RCD 2 — [Group Label]

| Circuit | Room(s) | Breaker | Cable | Sockets | Load Est. |
|---------|---------|---------|-------|---------|-----------|
| C4 | Bedroom 1 | 16A MCB Type B | 3×2.5mm² NYM-J | S15-S18 | ~2kW |

Repeat for each RCD group. A single fault on one RCD must NOT cut power to the entire property.

## 4. Wiring Schedule

For EACH circuit, show the cable route from the distribution board to the destination room(s).

| Circuit | From | To | Cable | Wires | Est. Length | Max Length | Via | Notes |
|---------|------|----|-------|-------|-------------|-----------|-----|-------|
| C1 | DB | Kitchen | NYM-J 3×2.5mm² | Brown(L), Blue(N), Green-Yellow(PE) | 12m | 27m | Hallway | Standard socket circuit |

### Wire Color Legend (per IEC 60446 / ${info.standards})
- **Brown** — Line (L) / Phase
- **Blue** — Neutral (N)
- **Green-Yellow** — Protective Earth (PE)
- **Black** — Line 2 (L2) — three-phase circuits only
- **Grey** — Line 3 (L3) — three-phase circuits only

Cable type: NYM-J (copper, PVC-insulated). Voltage drop must not exceed 3% per IEC 60364-5-52.

> **Note:** Cable lengths are estimates based on room positions. Verify all cable runs on-site before purchasing materials.

## 5. Distribution Board Layout
List the recommended order of circuits in the consumer unit/distribution board.

## 6. Material List

| Item | Specification | Quantity |
|------|--------------|----------|
| Socket outlets | ${info.socketType} | X outlet frames (Y total connection points, accounting for double/triple gang) |
| MCB 16A Type B | Per ${info.standards} | X |

Include cable quantities (meters of each cable type: 3×2.5mm², 3×1.5mm², 3×6mm², etc.)

## 7. Safety & Compliance

### Bathroom Zones (per IEC 60364-7-701)
Explain zones 0, 1, 2 and what's allowed in each.

### RCD Protection
All socket circuits protected by 30mA RCD (Type A recommended). Each RCD protects a maximum of 3–4 circuits for selectivity — a fault on one group does not affect other groups. Explain Type A vs Type AC.

### Earthing & Bonding
Equipotential bonding requirements for bathroom, kitchen.

### Applicable Standards Reference
- ${info.standards}
- IEC 60364-7-701 (Bathroom installations)
- IEC 60364-5-52 (Wiring systems)

## 8. User Guide (for Homeowners)
Write 5-8 practical tips in simple language:
- How to identify which circuit a socket belongs to
- When to call an electrician vs DIY
- Signs of electrical problems
- How to test RCD monthly
- Tips for energy efficiency with socket placement

---
*This specification was generated by Rosette — Electric Socket Planner. Always verify with a licensed electrician before installation.*`;
}

export function translationPrompt(lang: string): string {
  return `You are a professional technical translator specializing in electrical engineering documentation. Translate the following electrical installation specification from English to ${lang}.

CRITICAL RULES:
1. Translate EVERYTHING — all headings, labels, table headers, descriptions, notes, tips
2. Keep the EXACT same Markdown structure — same headings (##, ###), same tables, same lists
3. Keep ALL socket location details — translate "North wall, left section" to the ${lang} equivalent with the SAME precision
4. Keep ALL "Special notes" sections — if English says "No special notes" translate it, if it says "Refrigerator on dedicated circuit" translate it
5. Keep ALL table rows — do not skip or summarize any socket entries
6. Keep technical terms recognizable — "MCB", "RCD", "16A", "3×2.5mm²" stay as-is
7. Keep socket IDs (S1, S2, etc.) and circuit IDs (C1, C2, etc.) unchanged
8. The translated document must have the EXACT same number of sections, tables, and detail level as the English original
9. If a room has "Special notes" in English, the ${lang} version MUST also have them
10. Do NOT abbreviate, summarize, or skip ANY content`;
}

function roomBatches(rooms: SpecRoom[], placements: SpecPlacements): SpecRoom[][] {
  const batches: SpecRoom[][] = [];
  let current: SpecRoom[] = [];
  let sockets = 0;
  for (const room of rooms) {
    const count = placements.placements.filter((p) => p.room_id === room.id).length;
    if (current.length > 0 && (sockets + count > MAX_SOCKETS_PER_ROOM_BATCH || current.length === MAX_ROOMS_PER_ROOM_BATCH)) {
      batches.push(current);
      current = [];
      sockets = 0;
    }
    current.push(room);
    sockets += count;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function omit<T extends object>(value: T, keys: string[]): T {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) as T;
}

function countCircuits(placements: SpecPlacements): number {
  const listed = (key: string) => (Array.isArray(placements[key]) ? (placements[key] as unknown[]).length : 0);
  const assigned = new Set(placements.placements.map((p) => p.circuit).filter((id) => id !== undefined)).size;
  return Math.max(assigned, listed("circuits"), listed("wiring"));
}

export function planSpecificationParts(rooms: SpecRoom[], placements: SpecPlacements): SpecPart[] {
  // Only section 2 says where each socket sits, so only it gets coordinates,
  // walls and room outlines, and it does not need the cable routes.
  const summaryRooms = rooms.map((room) => omit(room, ["position"]));
  const summaryPlacements = { ...placements, placements: placements.placements.map((p) => omit(p, ["x_pct", "y_pct", "wall"])) };
  const roomPlacements = omit(placements, ["wiring"]);

  const parts: SpecPart[] = [
    {
      scope: "the title block, the --- line after it, and section 1 (Project Overview)",
      rooms: summaryRooms,
      placements: summaryPlacements,
      maxTokens: OVERVIEW_TOKENS,
    },
  ];
  const batches = roomBatches(rooms, placements);
  if (batches.length === 0) {
    parts.push({
      scope: 'section 2 (the "## 2. Room-by-Room Specification" heading and its content)',
      rooms,
      placements: roomPlacements,
      maxTokens: roomBatchTokens(0, placements.placements.length),
    });
  }
  let next = 1;
  batches.forEach((batch, index) => {
    const last = next + batch.length - 1;
    const ids = new Set(batch.map((room) => room.id));
    const heading = index === 0 ? 'the "## 2. Room-by-Room Specification" heading, then ' : "";
    const range = last === next ? `room subsection 2.${next}` : `room subsections 2.${next} to 2.${last}`;
    const sockets = placements.placements.filter((p) => ids.has(p.room_id));
    parts.push({
      scope: `${heading}${range} — one subsection per room, in the order given, numbered from 2.${next}`,
      rooms: batch,
      placements: { ...roomPlacements, placements: sockets },
      maxTokens: roomBatchTokens(batch.length, sockets.length),
    });
    next = last + 1;
  });
  parts.push(
    {
      scope: "sections 3, 4 and 5 (Circuit Schedule, Wiring Schedule with its colour legend and note, Distribution Board Layout)",
      rooms: summaryRooms,
      placements: summaryPlacements,
      maxTokens: scheduleTokens(countCircuits(placements)),
    },
    {
      scope: "sections 6, 7 and 8 (Material List, Safety & Compliance, User Guide for Homeowners), then the closing --- line and footer",
      rooms: summaryRooms,
      placements: summaryPlacements,
      maxTokens: CLOSING_TOKENS,
    },
  );
  return parts;
}

/** Splits Markdown at #, ## and ### headings only, so a table is never cut in two. */
export function splitForTranslation(markdown: string, maxChars = MAX_TRANSLATION_CHUNK_CHARS): string[] {
  const sections: string[] = [];
  let lines: string[] = [];
  for (const line of markdown.split("\n")) {
    if (/^#{1,3} /.test(line) && lines.length > 0) {
      sections.push(lines.join("\n"));
      lines = [];
    }
    lines.push(line);
  }
  sections.push(lines.join("\n"));

  const chunks: string[] = [];
  let chunk: string | undefined;
  for (const section of sections) {
    if (chunk !== undefined && chunk.length + 1 + section.length > maxChars) {
      chunks.push(chunk);
      chunk = section;
    } else {
      chunk = chunk === undefined ? section : `${chunk}\n${section}`;
    }
  }
  if (chunk !== undefined) chunks.push(chunk);
  return chunks.filter((c) => c.trim().length > 0);
}

// A part occasionally restates a heading another part owns (seen live: a later
// room batch opening with "## 2. Room-by-Room Specification"). Keep the first
// title and the first heading of each numbered section.
export function dropRepeatedHeadings(markdown: string): string {
  const seen = new Set<string>();
  return markdown
    .split("\n")
    .filter((line) => {
      const key = line.match(/^(#|## \d+\.)\s/)?.[1];
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

async function complete(
  client: AzureOpenAI,
  deployment: string,
  label: string,
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...completionOptions(deployment, maxTokens, temperature),
  });
  const choice = response.choices[0];
  const text = choice?.message?.content?.trim() || "";
  // A missing or cut-off part would silently drop sockets from an electrical spec.
  if (!text) throw new Error(`${label} came back empty`);
  if (choice?.finish_reason === "length") throw new Error(`${label} hit its ${maxTokens}-token limit`);
  return text;
}

export async function generateSpecification(
  client: AzureOpenAI,
  deployment: string,
  specPrompt: string,
  rooms: SpecRoom[],
  placements: SpecPlacements,
): Promise<string> {
  const parts = planSpecificationParts(rooms, placements);
  const texts = await Promise.all(
    parts.map((part, index) =>
      complete(
        client,
        deployment,
        `Specification part ${index + 1} of ${parts.length}`,
        `${specPrompt}\n\nWrite in English.\n\nThis document is produced in ${parts.length} parts that are joined afterwards. Write ONLY part ${index + 1}: ${part.scope}. Follow the format above exactly for that part. Do not write any other section, preamble or closing remark.`,
        `Generate part ${index + 1} of the specification.\n\nRooms:\n${JSON.stringify(part.rooms)}\n\nPlacements:\n${JSON.stringify(part.placements)}`,
        0.15,
        part.maxTokens,
      ),
    ),
  );
  return dropRepeatedHeadings(texts.join("\n\n"));
}

export async function translateSpecification(
  client: AzureOpenAI,
  deployment: string,
  english: string,
  lang: string,
): Promise<string> {
  const chunks = splitForTranslation(english);
  const texts = await Promise.all(
    chunks.map((chunk, index) =>
      complete(
        client,
        deployment,
        `Translation part ${index + 1} of ${chunks.length}`,
        `${translationPrompt(lang)}\n\nThe specification is translated in ${chunks.length} consecutive parts. This is part ${index + 1}. Translate only this part and return only the translation, without any preamble or comment.`,
        `Translate this specification to ${lang}. Keep every detail:\n\n${chunk}`,
        0.1,
        translationTokens(chunk),
      ),
    ),
  );
  return texts.join("\n\n");
}
