import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";
import { handleAssistantRequest } from "./server/assistant-handler.mjs";

function assistantDevEndpoint(): Plugin {
  return {
    name: "citynside-assistant-dev-endpoint",
    config(_config, { mode }) {
      const environment = loadEnv(mode, process.cwd(), "");
      for (const key of ["GROQ_API_KEY", "GROQ_MODEL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) {
        if (environment[key]) process.env[key] = environment[key];
      }
    },
    configureServer(server) {
      server.middlewares.use("/api/assistant", async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (typeof value === "string") headers.set(name, value);
        }
        const method = request.method || "POST";
        const body = Buffer.concat(chunks).toString("utf8");
        const apiRequest = new Request("http://localhost/api/assistant", {
          method,
          headers,
          ...(method === "GET" || method === "HEAD" ? {} : { body }),
        });
        const apiResponse = await handleAssistantRequest(apiRequest);
        response.statusCode = apiResponse.status;
        apiResponse.headers.forEach((value, name) => response.setHeader(name, value));
        response.end(await apiResponse.text());
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const georisquesProxyOrigin = environment.GEORISQUES_PROXY_ORIGIN?.replace(/\/$/, "");
  const georisquesProxy: ProxyOptions = georisquesProxyOrigin
    ? {
        target: georisquesProxyOrigin,
        changeOrigin: true,
        secure: true,
      }
    : {
        target: "https://www.georisques.gouv.fr",
        changeOrigin: true,
        secure: true,
        rewrite: (path: string) => path.replace(/^\/api\/georisques/, "/api/v1/resultats_rapport_risque"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("accept", "application/json");
            proxyReq.setHeader("user-agent", "Citynside/1.0 (georisques proxy)");
          });
        },
      };

  return {
    plugins: [react(), assistantDevEndpoint()],
    server: {
      proxy: {
        "/api/gtfs-stops": {
          target: "https://transport.data.gouv.fr",
          changeOrigin: true,
        },
        "/api/georisques": georisquesProxy,
      },
    },
  };
});
