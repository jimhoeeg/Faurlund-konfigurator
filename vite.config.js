import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serverer projektet fra /Faurlund-konfigurator/, ikke fra roden.
  // Sættes af arbejdsgangen; lokalt kører vi fra roden som normalt.
  base: process.env.VITE_BASE || "/",
});
