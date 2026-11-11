import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AzureOpenAI } from "openai";
import { buildDetailedErrorMessage } from "../utils/errorMessage";
import { countryInfo, translateSpecification } from "../utils/specification";

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
const apiKey = process.env.AZURE_OPENAI_KEY || "";
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-6-luna";

// A generated specification is roughly 15-25k characters.
const MAX_SPEC_CHARS = 100_000;

app.http("translate-description", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "translate-description",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { description_en?: unknown; countryCode?: string };
      const english = typeof body.description_en === "string" ? body.description_en.trim() : "";
      if (!english || english.length > MAX_SPEC_CHARS) {
        return {
          status: 400,
          jsonBody: { error: "description_en must be a non-empty specification under 100,000 characters" },
        };
      }

      const info = countryInfo(body.countryCode);
      const client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-10-21", deployment });
      const local = await translateSpecification(client, deployment, english, info.lang);

      return {
        status: 200,
        jsonBody: {
          description_local: local,
          language: { name: info.lang, code: info.code },
        },
      };
    } catch (error: unknown) {
      return {
        status: 500,
        jsonBody: { error: buildDetailedErrorMessage("translate-description", error, "Description translation failed") },
      };
    }
  },
});
