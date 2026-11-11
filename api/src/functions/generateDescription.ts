import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AzureOpenAI } from "openai";
import { buildDetailedErrorMessage } from "../utils/errorMessage";
import { buildSpecPrompt, countryInfo, generateSpecification } from "../utils/specification";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-6-luna";

// Returns the English specification only. The client then calls
// translate-description, so each request gets its own 45 s SWA budget.
app.http("generate-description", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate-description",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { rooms: any[]; placements: any; countryCode: string; propertyType: string };
      const cc = body.countryCode || "LV";
      const info = countryInfo(cc);
      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-10-21", deployment });

      const roomsClean = body.rooms.map((r: any) => ({
        id: r.id, type: r.type, name: r.name,
        area_m2: r.area_m2, width_m: r.width_m, height_m: r.height_m,
        position: r.position,
        features: r.features, requested_sockets: r.requested_sockets,
      }));
      const placementsClean = {
        placements: (body.placements.placements || []).map((p: any) => ({
          socket_id: p.socket_id, room_id: p.room_id, room_name: p.room_name,
          x_pct: p.x_pct, y_pct: p.y_pct,
          wall: p.wall, height_mm: p.height_mm, type: p.type, gang: p.gang || 1,
          circuit: p.circuit, notes: p.notes,
        })),
        circuits: body.placements.circuits || [],
        wiring: body.placements.wiring || [],
        total_sockets: body.placements.total_sockets,
        total_circuits: body.placements.total_circuits,
        total_cable_m: body.placements.total_cable_m,
      };

      const englishSpec = await generateSpecification(
        client,
        deployment,
        buildSpecPrompt(cc, info, body.propertyType),
        roomsClean,
        placementsClean,
      );

      return {
        status: 200,
        jsonBody: {
          description_en: englishSpec,
          language: { name: info.lang, code: info.code },
        },
      };
    } catch (error: unknown) {
      return {
        status: 500,
        jsonBody: { error: buildDetailedErrorMessage("generate-description", error, "Description generation failed") },
      };
    }
  },
});
