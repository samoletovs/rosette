import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

interface RoomRule {
  minimum_sockets: number;
  [key: string]: any;
}

interface CountryStandard {
  country: string;
  country_code: string;
  standard: string;
  voltage: string;
  socket_type: string;
  room_rules: Record<string, RoomRule>;
  [key: string]: any;
}

function parseStandardsFile(content: string): CountryStandard {
  const result: any = { room_rules: {} };

  const metadataMatch = content.match(/## Metadata\n([\s\S]*?)(?=\n## )/);
  if (metadataMatch) {
    for (const line of metadataMatch[1].split("\n")) {
      const match = line.match(/- \*\*(\w+)\*\*:\s*(.+)/);
      if (match) result[match[1]] = match[2].trim();
    }
  }

  const roomSection = content.match(/## Room Rules\n([\s\S]*?)(?=\n## Circuit|$)/);
  if (roomSection) {
    for (const block of roomSection[1].split(/\n### /)) {
      if (!block.trim()) continue;
      const nameMatch = block.match(/^(.+?)[\n]/);
      if (!nameMatch) continue;
      const roomName = nameMatch[1].trim().toLowerCase().replace(/ \/ /g, "_").replace(/ /g, "_").replace(/[()]/g, "").replace(/_+/g, "_");
      const room: RoomRule = { minimum_sockets: 0 };
      const minMatch = block.match(/\*\*minimum_sockets\*\*:\s*(\d+)/);
      if (minMatch) room.minimum_sockets = parseInt(minMatch[1]);
      const notesMatch = block.match(/\*\*notes\*\*:\s*(.+)/);
      if (notesMatch) room.notes = notesMatch[1];
      result.room_rules[roomName] = room;
    }
  }
  return result as CountryStandard;
}

function loadStandards(): Map<string, CountryStandard> {
  const standards = new Map<string, CountryStandard>();
  const paths = [join(__dirname, "..", "..", "..", "standards"), join(__dirname, "..", "..", "standards"), join(process.cwd(), "standards")];
  for (const dir of paths) {
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md");
      for (const file of files) {
        const code = file.replace(".md", "").toUpperCase();
        standards.set(code, parseStandardsFile(readFileSync(join(dir, file), "utf-8")));
      }
      if (standards.size > 0) break;
    } catch { continue; }
  }
  return standards;
}

const standardsCache = loadStandards();

app.http("standards", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "standards/{country?}",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    const country = request.params.country?.toUpperCase();
    if (!country) {
      return { status: 200, jsonBody: { countries: Array.from(standardsCache.entries()).map(([code, std]) => ({ code, country: std.country, standard: std.standard })) } };
    }
    const standard = standardsCache.get(country);
    if (!standard) return { status: 404, jsonBody: { error: `Standards not found for: ${country}` } };
    return { status: 200, jsonBody: standard };
  },
});
