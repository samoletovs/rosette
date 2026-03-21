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
      const bytes = new Uint8Array(arrayBuffer);

      // Validate file magic bytes
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
      const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45;
      if (!isPng && !isJpeg && !isPdf && !isWebp) {
        return { status: 400, jsonBody: { error: "Invalid file content. Only PNG, JPEG, WebP, and PDF are accepted." } };
      }

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
