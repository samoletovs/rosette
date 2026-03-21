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
            content: `You are an expert electrician. Based on room analysis and construction standards, calculate optimal socket placements.

Standards for ${body.countryCode}: ${JSON.stringify(body.standards?.room_rules || {}, null, 2)}

IMPORTANT: Each room has a "requested_sockets" field — this is the number of sockets the user wants for that room. You MUST place exactly that many sockets in each room. Do not add fewer or more.

Rules: Standard height 300mm, kitchen countertop 1000-1200mm, min 600mm from water, all circuits need 30mA RCD.

Respond in JSON:
{ "placements": [{ "room_id": "room_1", "room_name": "Kitchen", "socket_id": "s1", "x_pct": 15, "y_pct": 25, "wall": "north", "height_mm": 300, "type": "standard_16a", "circuit": "circuit_1", "notes": "" }], "circuits": [{ "id": "circuit_1", "type": "standard", "breaker": "16A MCB", "cable": "3x2.5mm²", "rcd": "30mA", "sockets": ["s1"] }], "total_sockets": 25, "total_circuits": 8, "summary": "Brief description" }`,
          },
          { role: "user", content: `Plan sockets for ${body.propertyType || "residential"} property:\n${JSON.stringify(body.rooms, null, 2)}` },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { status: 500, jsonBody: { error: "Failed to generate placements" } };
      return { status: 200, jsonBody: JSON.parse(jsonMatch[0]) };
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Calculation failed" } };
    }
  },
});
