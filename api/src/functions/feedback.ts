import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { TableClient, TableServiceClient } from "@azure/data-tables";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const TABLE_NAME = "feedback";

async function getTableClient(): Promise<TableClient> {
  const serviceClient = TableServiceClient.fromConnectionString(connectionString);
  // Ensure table exists
  try {
    await serviceClient.createTable(TABLE_NAME);
  } catch (e: any) {
    // TableAlreadyExists is fine
    if (e.statusCode !== 409) throw e;
  }
  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

// POST /api/feedback — submit new feedback
app.http("feedbackSubmit", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "feedback",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as {
        type: string;
        title: string;
        description: string;
        page?: string;
      };

      if (!body.title || !body.title.trim()) {
        return { status: 400, jsonBody: { error: "Title is required" } };
      }
      if (!body.description || !body.description.trim()) {
        return { status: 400, jsonBody: { error: "Description is required" } };
      }

      const allowedTypes = ["bug", "feature", "improvement", "other"];
      const type = allowedTypes.includes(body.type) ? body.type : "other";

      const timestamp = new Date().toISOString();
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const tableClient = await getTableClient();
      const entity = {
        partitionKey: "feedback",
        rowKey: id,
        type,
        title: body.title.trim().slice(0, 200),
        description: body.description.trim().slice(0, 2000),
        page: (body.page || "").slice(0, 100),
        status: "open",
        createdAt: timestamp,
      };

      await tableClient.createEntity(entity);

      return {
        status: 201,
        jsonBody: { id, message: "Feedback submitted successfully" },
      };
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Failed to submit feedback" } };
    }
  },
});

// GET /api/feedback — list feedback items (optionally filtered by status)
app.http("feedbackList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "feedback/list",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const status = request.query.get("status") || "open";
      const tableClient = await getTableClient();

      const items: any[] = [];

      // If "all", don't filter by status
      const entities =
        status === "all"
          ? tableClient.listEntities({ queryOptions: { filter: `PartitionKey eq 'feedback'` } })
          : tableClient.listEntities({
              queryOptions: { filter: `PartitionKey eq 'feedback' and status eq '${status}'` },
            });

      for await (const entity of entities) {
        items.push({
          id: entity.rowKey,
          type: entity.type,
          title: entity.title,
          description: entity.description,
          page: entity.page,
          status: entity.status,
          createdAt: entity.createdAt,
        });
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        status: 200,
        jsonBody: { items, count: items.length },
      };
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Failed to list feedback" } };
    }
  },
});

// PATCH /api/feedback/:id — update feedback status
app.http("feedbackUpdate", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "feedback/{id}",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const id = request.params.id;
      if (!id) return { status: 400, jsonBody: { error: "Feedback ID is required" } };

      const body = (await request.json()) as { status?: string };
      const allowedStatuses = ["open", "in-progress", "done", "closed"];
      if (!body.status || !allowedStatuses.includes(body.status)) {
        return { status: 400, jsonBody: { error: `Status must be one of: ${allowedStatuses.join(", ")}` } };
      }

      const tableClient = await getTableClient();

      // Verify entity exists
      await tableClient.getEntity("feedback", id);
      await tableClient.updateEntity(
        { partitionKey: "feedback", rowKey: id, status: body.status },
        "Merge"
      );

      return { status: 200, jsonBody: { id, status: body.status, message: "Feedback updated" } };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return { status: 404, jsonBody: { error: "Feedback not found" } };
      }
      return { status: 500, jsonBody: { error: error.message || "Failed to update feedback" } };
    }
  },
});
