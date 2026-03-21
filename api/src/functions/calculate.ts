import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AzureOpenAI } from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";

app.http("calculate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "calculate",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { rooms: any[]; countryCode: string; propertyType: string; standards: any };
      if (!body.rooms || !body.countryCode) return { status: 400, jsonBody: { error: "rooms and countryCode required" } };

      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-08-01-preview", deployment });

      const response = await client.chat.completions.create({
        model: deployment,
        messages: [
          {
            role: "system",
            content: `You are an expert electrician. Based on room analysis and construction standards, calculate optimal socket placements and wiring routes from the distribution board.

Standards for ${body.countryCode}: ${JSON.stringify(body.standards?.room_rules || {}, null, 2)}

Wiring standards: ${JSON.stringify(body.standards?.wiring || {}, null, 2)}

IMPORTANT: Each room has a "requested_sockets" field — this is the number of sockets the user wants for that room. You MUST place exactly that many sockets in each room. Do not add fewer or more.

Rules: Standard height 300mm, kitchen countertop 1000-1200mm, min 600mm from water, all circuits need 30mA RCD.

Wiring rules:
- Use wire colors per IEC 60446: Brown (L), Blue (N), Green-Yellow (PE). For three-phase: add Black (L2), Grey (L3).
- Cable type: NYM-J. Standard 16A circuit = 3×2.5mm². Lighting = 3×1.5mm². Oven 32A = 3×6mm². Three-phase = 5×4mm² or 5×6mm².
- Max cable run for 3% voltage drop: ~27m for 2.5mm²@16A, ~27m for 6mm²@32A.
- Estimate cable length based on room distances from the switchboard location.

Respond in JSON:
{ "placements": [{ "room_id": "room_1", "room_name": "Kitchen", "socket_id": "s1", "x_pct": 15, "y_pct": 25, "wall": "north", "height_mm": 300, "type": "standard_16a", "circuit": "circuit_1", "notes": "" }], "circuits": [{ "id": "circuit_1", "type": "standard", "breaker": "16A MCB", "cable": "3x2.5mm²", "rcd": "30mA", "sockets": ["s1"] }], "wiring": [{ "circuit_id": "circuit_1", "cable_type": "NYM-J 3×2.5mm²", "from": "switchboard", "to_room": "Kitchen", "to_room_id": "room_1", "wire_count": 3, "wire_colors": ["Brown (L)", "Blue (N)", "Green-Yellow (PE)"], "estimated_length_m": 12, "max_length_m": 27, "passes_through": ["Hallway"], "notes": "" }], "total_sockets": 25, "total_circuits": 8, "total_cable_m": 120, "summary": "Brief description" }`,
          },
          { role: "user", content: `Plan sockets and wiring for ${body.propertyType || "residential"} property:\n${JSON.stringify(body.rooms, null, 2)}` },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { status: 500, jsonBody: { error: "Failed to generate socket placements" } };
      try {
        return { status: 200, jsonBody: JSON.parse(jsonMatch[0]) };
      } catch {
        return { status: 500, jsonBody: { error: "AI returned malformed placement data. Please try again." } };
      }
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Calculation failed" } };
    }
  },
});
