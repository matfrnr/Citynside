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
      "/api/georisques": {
        target: "https://www.georisques.gouv.fr",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/georisques/, "/api/v1/resultats_rapport_risque"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("accept", "application/json");
            proxyReq.setHeader("user-agent", "Citynside/1.0 (georisques proxy)");
          });
        },
      },
    },
  },
});
