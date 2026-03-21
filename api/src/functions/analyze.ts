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

      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-08-01-preview", deployment });

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

Property type: ${body.propertyType || "residential"}

Respond in JSON: { "rooms": [{ "id": "room_1", "type": "kitchen", "name": "Kitchen", "width_m": 3.5, "height_m": 4.0, "area_m2": 14.0, "position": { "x_pct": 10, "y_pct": 20, "w_pct": 25, "h_pct": 30 }, "features": ["window_south", "sink", "door_to_hallway"] }], "total_area_m2": 75, "property_type": "apartment" }`,
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
      if (!jsonMatch) return { status: 500, jsonBody: { error: "Failed to parse room analysis" } };

      return { status: 200, jsonBody: JSON.parse(jsonMatch[0]) };
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Analysis failed" } };
    }
  },
});
