import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AzureOpenAI } from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";

app.http("proposePlacements", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "propose-placements",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as {
        rooms: Array<{
          id: string;
          type: string;
          name: string;
          width_m: number;
          height_m: number;
          area_m2: number;
          position: { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
          features: string[];
          requested_sockets?: number;
        }>;
        countryCode: string;
        propertyType: string;
        standards: Record<string, unknown>;
        switchboard: {
          room_id: string;
          room_name: string;
          wall: string;
          height_mm: number;
          reason: string;
        };
      };

      if (!body.rooms || !body.countryCode) {
        return { status: 400, jsonBody: { error: "rooms and countryCode required" } };
      }

      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-10-21", deployment });

      const response = await client.chat.completions.create({
        model: deployment,
        messages: [
          {
            role: "system",
            content: `You are an expert electrician planning socket positions on a floor plan.

Given rooms with their positions (as percentage coordinates on the floor plan image), propose optimal positions for each socket and the distribution board.

Each room has a "requested_sockets" count — place EXACTLY that many sockets per room. Each room has a "position" object with x_pct, y_pct (top-left corner), w_pct, h_pct (width and height in %) — all socket positions must be WITHIN the room's bounding box.

Placement rules:
- Standard sockets at 300mm height, place along walls (near edges of the room rectangle)
- Kitchen countertop sockets at 1000-1200mm, place along the wall opposite from the door
- At least 600mm from water sources (sinks, showers)
- Bedside sockets at 600mm height
- Space sockets evenly along walls — don't cluster them all on one wall
- Place sockets on different walls of each room for good coverage

Distribution board: Place at the suggested switchboard location within the room it belongs to.

Standards for ${body.countryCode}: ${JSON.stringify(body.standards?.room_rules || {}, null, 2)}

Respond in JSON:
{
  "switchboard": {
    "room_id": "room_3",
    "room_name": "Hallway",
    "wall": "north",
    "height_mm": 1600,
    "reason": "explanation",
    "x_pct": 45.2,
    "y_pct": 12.5
  },
  "placements": [
    {
      "room_id": "room_1",
      "room_name": "Kitchen",
      "socket_id": "s1",
      "x_pct": 12.5,
      "y_pct": 22.3,
      "wall": "north",
      "height_mm": 300,
      "type": "standard_16a",
      "notes": ""
    }
  ]
}

IMPORTANT: x_pct and y_pct are percentages relative to the FULL floor plan image (0-100). Each socket's x_pct/y_pct must be within its room's bounding box (room.position).`,
          },
          {
            role: "user",
            content: `Propose socket positions for this ${body.propertyType || "residential"} property.

Switchboard suggestion from analysis: ${JSON.stringify(body.switchboard)}

Rooms:
${JSON.stringify(body.rooms, null, 2)}`,
          },
        ],
        max_tokens: 6000,
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { status: 500, jsonBody: { error: "Failed to generate placement proposal" } };
      }

      try {
        return { status: 200, jsonBody: JSON.parse(jsonMatch[0]) };
      } catch {
        return { status: 500, jsonBody: { error: "AI returned malformed placement data. Please try again." } };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Proposal failed";
      return { status: 500, jsonBody: { error: message } };
    }
  },
});
