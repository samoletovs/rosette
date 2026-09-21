import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function lazyFeatureReport(): Plugin {
  const features = {
    placement: { entry: "/src/components/PlacementEditor.tsx", packages: /\/node_modules\/(?:react-konva|konva)\// },
    markdown: { entry: "/src/components/SpecificationMarkdown.tsx", packages: /\/node_modules\/(?:react-markdown|remark-gfm|unified|mdast-[^/]+|micromark[^/]*)\// },
    pdf: { entry: "/src/pdfExport.ts", packages: /\/node_modules\/(?:jspdf|svg2pdf\.js|html2canvas|canvg)\// },
  };
  return {
    name: "rosette-lazy-feature-report",
    apply: "build",
    generateBundle(_options, bundle) {
      const report: Record<string, { entry: string; chunks: string[] }> = {};
      for (const [name, feature] of Object.entries(features)) {
        const result: { entry: string; chunks: string[] } = { entry: "", chunks: [] };
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") continue;
          const modules = Object.keys(output.modules).map((id) => id.replaceAll("\\", "/"));
          const isEntry = output.facadeModuleId?.replaceAll("\\", "/").endsWith(feature.entry) || modules.some((id) => id.endsWith(feature.entry));
          if (isEntry) result.entry = output.fileName;
          if (isEntry || modules.some((id) => feature.packages.test(id))) result.chunks.push(output.fileName);
        }
        if (!result.entry || !result.chunks.length) this.error(`Missing lazy feature modules: ${name}`);
        report[name] = result;
      }
      const eager = new Set<string>();
      const visit = (fileName: string): void => {
        if (eager.has(fileName)) return;
        eager.add(fileName);
        const output = bundle[fileName];
        if (output?.type === "chunk") output.imports.forEach(visit);
      };
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk" && output.isEntry) visit(output.fileName);
      }
      for (const [name, feature] of Object.entries(report)) {
        const premature = feature.chunks.filter((fileName) => eager.has(fileName));
        if (premature.length) this.error(`${name} code is statically eager: ${premature.join(", ")}`);
      }
      this.emitFile({ type: "asset", fileName: "lazy-chunks.json", source: JSON.stringify(report, null, 2) });
    },
  };
}

export default defineConfig({
  plugins: [react(), lazyFeatureReport()],
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
  },
});
