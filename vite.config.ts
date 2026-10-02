import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/gtfs-stops": {
        target: "https://transport.data.gouv.fr",
        changeOrigin: true,
      },
    },
  },
});
