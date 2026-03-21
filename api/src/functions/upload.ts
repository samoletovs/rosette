import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";

app.http("upload", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "upload",
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return { status: 400, jsonBody: { error: "No file provided" } };
      }

      const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        return { status: 400, jsonBody: { error: "File type not supported. Use PNG, JPEG, WebP, or PDF." } };
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return { status: 400, jsonBody: { error: "File too large. Maximum 10MB." } };
      }

      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient("uploads");

      const id = randomUUID();
      const ext = file.name.split(".").pop() || "png";
      const blobName = `${id}.${ext}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const arrayBuffer = await file.arrayBuffer();
      await blockBlobClient.upload(arrayBuffer, arrayBuffer.byteLength, {
        blobHTTPHeaders: { blobContentType: file.type },
      });

      return {
        status: 200,
        jsonBody: { id, blobName, url: blockBlobClient.url, contentType: file.type },
      };
    } catch (error: any) {
      return { status: 500, jsonBody: { error: error.message || "Upload failed" } };
    }
  },
});
