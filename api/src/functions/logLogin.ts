import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { TableClient, TableServiceClient } from "@azure/data-tables";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const TABLE_NAME = "logins";
const TELEGRAM_NOTIFY_URL = process.env.TELEGRAM_NOTIFY_URL || '';

async function getTableClient(): Promise<TableClient> {
  const serviceClient = TableServiceClient.fromConnectionString(connectionString);
  try {
    await serviceClient.createTable(TABLE_NAME);
  } catch (e: any) {
    if (e.statusCode !== 409) throw e;
  }
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

app.http("logLogin", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "log-login",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const header = request.headers.get("x-ms-client-principal");
      if (!header) return { status: 401, jsonBody: { error: "Not authenticated" } };

      const principal = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
      const email = principal.userDetails || "unknown";
      const provider = principal.identityProvider || "unknown";
      const userId = principal.userId || "unknown";

      const tableClient = await getTableClient();
      const now = new Date();
      await tableClient.createEntity({
        partitionKey: email,
        rowKey: now.toISOString(),
        provider,
        userId,
        email,
        timestamp: now.toISOString(),
      });

      fetch(TELEGRAM_NOTIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `👤 rosette login\n\nUser: ${email}\nProvider: ${provider}\nTime: ${now.toISOString()}`
        })
      }).catch(() => {});

      return { status: 200, jsonBody: { logged: true } };
    } catch (error: any) {
      // Don't fail the app if logging fails
      return { status: 200, jsonBody: { logged: false, error: error.message } };
    }
  },
});
