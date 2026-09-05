/**
 * Byg til én selvstændig HTML-fil, der kan deles som et link.
 * Alt samles i én bundle — også de dele, der normalt hentes efter behov —
 * så siden virker uden en server bag sig.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-demo",
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
