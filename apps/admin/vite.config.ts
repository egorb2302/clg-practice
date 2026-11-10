import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiPort = process.env.API_PORT ?? "3350";

export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? process.env.PORT ?? 3351),
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}`, "/media": `http://127.0.0.1:${apiPort}` },
  },
  build: { outDir: "dist", sourcemap: false },
});
