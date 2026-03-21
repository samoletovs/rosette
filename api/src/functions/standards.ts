import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { STANDARDS_DATA } from "../standardsData";

app.http("standards", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "standards/{country?}",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    const country = request.params.country?.toUpperCase();

    if (!country) {
      const countries = Object.entries(STANDARDS_DATA).map(([code, std]) => ({
        code,
        country: std.country,
        standard: std.standard,
      }));
      return { status: 200, jsonBody: { countries } };
    }

    const standard = STANDARDS_DATA[country];
    if (!standard) {
      return { status: 404, jsonBody: { error: `Standards not found for: ${country}` } };
    }

    return { status: 200, jsonBody: standard };
  },
});
