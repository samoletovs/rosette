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

      const [enResponse, localResponse] = await Promise.all([
        client.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: "system",
              content: `You are an expert electrician writing a professional electrical installation specification in English.

IMPORTANT RULES:
- For socket locations, describe using human-readable terms: wall name (north/south/east/west), position on wall (near door, center of wall, near window, above countertop, beside bed), and height from floor in mm.
- Do NOT use percentage coordinates or technical x/y values. Users need practical descriptions.
- Include: project overview, room-by-room socket specs, circuit schedule as a proper Markdown table, material list, safety notes.
- The circuit schedule MUST be a proper Markdown table with | separators and a header row with --- separators.
- Use Markdown with proper headings (##), bullet lists, and tables.`,
            },
            {
              role: "user",
              content: `Generate a complete English electrical installation specification for this ${body.propertyType || "residential"} property in ${body.countryCode}.\nRooms: ${JSON.stringify(body.rooms)}\nSocket placements: ${JSON.stringify(body.placements)}`,
            },
          ],
          max_tokens: 4000,
          temperature: 0.3,
        }),
        client.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: "system",
              content: `You are an expert electrician writing a professional electrical installation specification entirely in ${lang.name} language. Write EVERYTHING in ${lang.name}.

IMPORTANT RULES:
- For socket locations, describe using human-readable terms: wall name, position on wall (near door, center of wall, near window, above countertop, beside bed), and height from floor in mm.
- Do NOT use percentage coordinates or technical x/y values. Users need practical descriptions like "center of north wall" or "next to the entrance door".
- Include the SAME level of detail as an English specification: project overview, room-by-room socket specs with wall + position + height + circuit, circuit schedule as a proper Markdown table, material list, safety notes.
- The circuit schedule MUST be a proper Markdown table with | separators and a header row with --- separators.
- Use Markdown with proper headings (##), bullet lists, and tables.
- ALL text must be in ${lang.name}, including headings, labels, and notes.`,
            },
            {
              role: "user",
              content: `Generate a complete ${lang.name} language electrical installation specification for this ${body.propertyType || "residential"} property in ${body.countryCode}.\nRooms: ${JSON.stringify(body.rooms)}\nSocket placements: ${JSON.stringify(body.placements)}`,
            },
          ],
          max_tokens: 4000,
          temperature: 0.3,
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
