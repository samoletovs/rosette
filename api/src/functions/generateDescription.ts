import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AzureOpenAI } from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";

const COUNTRY_LANGUAGES: Record<string, { name: string; code: string }> = {
  LV: { name: "Latvian", code: "lv" },
  LT: { name: "Lithuanian", code: "lt" },
  EE: { name: "Estonian", code: "ee" },
};

app.http("generate-description", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate-description",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { rooms: any[]; placements: any; countryCode: string; propertyType: string };

      const lang = COUNTRY_LANGUAGES[body.countryCode] || { name: "Latvian", code: "lv" };
      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-08-01-preview", deployment });

      const specRules = `You are a certified master electrician writing a professional electrical installation specification.

SOCKET LOCATION DESCRIPTION RULES (CRITICAL):
For each socket, describe its location exactly as it would appear on an electrical blueprint:
1. **Wall**: Which wall (e.g., "North wall", "Wall adjacent to hallway door", "Kitchen counter wall")
2. **Position on wall**: Use landmarks — "200mm left of the entrance door", "centered between window and corner", "above the sink area", "at bedside table position (left)", "between the stove and refrigerator". NEVER use percentages.
3. **Height**: Exact height from finished floor level in mm (300mm standard, 600mm bedside, 1100mm countertop, etc.)
4. **Purpose/function**: What the socket is for — "general purpose", "refrigerator (dedicated)", "TV and peripherals", "bedside charging", "washing machine (dedicated)", "countertop appliances"
5. **Distance from water**: If in kitchen or bathroom, note min distance from nearest water source

ROOM DESCRIPTION RULES:
- For each room, first state: room name, dimensions, area, door/window locations
- Then list each socket with the format above
- Note any dedicated circuits separately

DOCUMENT STRUCTURE (use proper Markdown):
1. ## Project Overview — property type, total rooms, total sockets, total circuits, standard reference
2. ## Room Specifications — each room as ### with socket list
3. ## Circuit Schedule — MUST be a proper Markdown table:
   | Circuit | Type | Breaker | Cable | RCD | Connected Sockets |
   |---------|------|---------|-------|-----|-------------------|
4. ## Material Summary — quantities of each item type
5. ## Safety & Compliance — RCD protection, bathroom zones, grounding, applicable standards
6. ## Installation Notes — cable routing recommendations, testing requirements`;

      const roomsClean = body.rooms.map((r: any) => ({ id: r.id, type: r.type, name: r.name, area_m2: r.area_m2, width_m: r.width_m, height_m: r.height_m, features: r.features }));
      const placementsClean = {
        placements: (body.placements.placements || []).map((p: any) => ({ socket_id: p.socket_id, room_id: p.room_id, room_name: p.room_name, wall: p.wall, height_mm: p.height_mm, type: p.type, circuit: p.circuit, notes: p.notes })),
        circuits: body.placements.circuits || [],
        total_sockets: body.placements.total_sockets,
        total_circuits: body.placements.total_circuits,
      };

      const [enResponse, localResponse] = await Promise.all([
        client.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: "system",
              content: `${specRules}\n\nWrite the specification in English.`,
            },
            {
              role: "user",
              content: `Generate a complete electrical installation specification for this ${body.propertyType || "residential"} property (country: ${body.countryCode}).\n\nRooms:\n${JSON.stringify(roomsClean, null, 2)}\n\nSocket placements:\n${JSON.stringify(placementsClean, null, 2)}`,
            },
          ],
          max_tokens: 4000,
          temperature: 0.2,
        }),
        client.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: "system",
              content: `${specRules}\n\nWrite the ENTIRE specification in ${lang.name} language. ALL headings, labels, descriptions, and notes must be in ${lang.name}. Use the same structure and level of detail as described above.`,
            },
            {
              role: "user",
              content: `Generate a complete ${lang.name} electrical installation specification for this ${body.propertyType || "residential"} property (country: ${body.countryCode}).\n\nRooms:\n${JSON.stringify(roomsClean, null, 2)}\n\nSocket placements:\n${JSON.stringify(placementsClean, null, 2)}`,
            },
          ],
          max_tokens: 4000,
          temperature: 0.2,
        }),
      ]);

      return {
        status: 200,
        jsonBody: {
          description_en: enResponse.choices[0]?.message?.content || "",
          description_local: localResponse.choices[0]?.message?.content || "",
          language: lang,
        },
      };
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Description generation failed" } };
    }
  },
});
