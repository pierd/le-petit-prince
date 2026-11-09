import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://<user>.github.io/le-petit-prince/
export default defineConfig({
  base: process.env.BASE_PATH ?? "/le-petit-prince/",
  plugins: [react()],
});
