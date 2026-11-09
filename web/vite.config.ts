import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.BASE_PATH ?? "/le-petit-prince/";

// Served from https://<user>.github.io/le-petit-prince/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      // Precache only the app shell; data, images and audio are saved on request (src/offline.ts).
      injectManifest: { globPatterns: ["**/*.{js,css,html}", "favicon.png", "apple-touch-icon.png", "icon-*.png"] },
      manifest: {
        name: "Le Petit Prince",
        short_name: "Petit Prince",
        description: "Le Petit Prince in French with a Spanish translation, grammar notes and the audiobook.",
        lang: "fr",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#fbf8f1",
        theme_color: "#fbf8f1",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
