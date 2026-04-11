import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AzureOpenAI } from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";

app.http("analyze", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "analyze",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { imageUrl: string; propertyType: string };
      if (!body.imageUrl) {
        return { status: 400, jsonBody: { error: "imageUrl is required" } };
      }
      if (!body.imageUrl.startsWith("data:") && !body.imageUrl.startsWith("https://")) {
        return { status: 400, jsonBody: { error: "Invalid image URL format" } };
      }
      if (body.imageUrl.length > 15 * 1024 * 1024) {
        return { status: 413, jsonBody: { error: "Image data too large (max 10MB)" } };
      }

      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-10-21", deployment });

      const response = await client.chat.completions.create({
        model: deployment,
        messages: [
          {
            role: "system",
            content: `You are an expert architectural floor plan analyzer. Analyze the provided floor plan image and identify all rooms. For each room, provide:
1. Room type (kitchen, living_room, bedroom, bathroom, hallway, wc, home_office, utility_room, garage, balcony)
2. Approximate dimensions in meters (width x height)
3. Approximate area in square meters
4. Position on the plan (as percentage coordinates: x%, y% from top-left)
5. Notable features (windows, doors, water sources)

Also propose the best location for the distribution board (switchboard/consumer unit). Rules:
- Prefer hallway near the main entrance, utility room, or garage
- Must be in a dry, accessible location
- Height: 1400-1800mm from finished floor level per IEC 60364
- Consider shortest cable runs to all rooms

Property type: ${body.propertyType || "residential"}

Respond in JSON: { "rooms": [{ "id": "room_1", "type": "kitchen", "name": "Kitchen", "width_m": 3.5, "height_m": 4.0, "area_m2": 14.0, "position": { "x_pct": 10, "y_pct": 20, "w_pct": 25, "h_pct": 30 }, "features": ["window_south", "sink", "door_to_hallway"] }], "switchboard": { "room_id": "room_3", "room_name": "Hallway", "wall": "north", "height_mm": 1600, "reason": "Near main entrance, central location for shortest cable runs" }, "total_area_m2": 75, "property_type": "apartment" }`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: body.imageUrl, detail: "high" } },
              { type: "text", text: "Analyze this floor plan. Identify all rooms with their types, dimensions, and positions." },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { status: 500, jsonBody: { error: "Failed to parse room analysis from AI response" } };

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.rooms || !Array.isArray(parsed.rooms)) {
          return { status: 500, jsonBody: { error: "AI did not return valid room data" } };
        }
        return { status: 200, jsonBody: parsed };
      } catch {
        return { status: 500, jsonBody: { error: "AI returned malformed data. Please try again." } };
      }
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Analysis failed" } };
    }
  },
});
