import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:7071",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("react-markdown") || id.includes("remark-gfm") || id.includes("unified") || id.includes("mdast") || id.includes("micromark")) return "markdown";
          if (id.includes("pdfkit") || id.includes("html2canvas") || id.includes("jspdf") || id.includes("svg2pdf")) return "pdf";
        },
      },
    },
  },
});
