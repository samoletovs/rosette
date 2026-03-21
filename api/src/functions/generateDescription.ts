import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AzureOpenAI } from "openai";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o";

app.http("generate-description", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate-description",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { rooms: any[]; placements: any; countryCode: string; propertyType: string };

      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-08-01-preview", deployment });

      const response = await client.chat.completions.create({
        model: deployment,
        messages: [
          {
            role: "system",
            content: `You are an expert electrician writing a professional electrical installation specification. Include: project overview, room-by-room specs, circuit schedule, material list, safety notes. Use Markdown.`,
          },
          {
            role: "user",
            content: `Generate specification for ${body.propertyType || "residential"} in ${body.countryCode || "LV"}.\nRooms: ${JSON.stringify(body.rooms)}\nPlacements: ${JSON.stringify(body.placements)}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      });

      return { status: 200, jsonBody: { description: response.choices[0]?.message?.content || "" } };
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Description generation failed" } };
    }
  },
});
