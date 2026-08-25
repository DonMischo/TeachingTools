/**
 * Zweiter, kleiner Build neben Next: die Simulationen als eine Datei.
 * Alles wird eingebettet (auch die KaTeX-Schriften), damit die fertige HTML
 * per Doppelklick läuft — ohne Server, ohne Installation.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "standalone"),
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  css: { postcss: resolve(__dirname) },
  build: {
    outDir: resolve(__dirname, ".standalone-build"),
    emptyOutDir: true,
    // Schriften und Bilder als data:-URI statt als Nachbardatei
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
