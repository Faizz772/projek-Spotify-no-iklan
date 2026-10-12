import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

function iosReferencePage(): Plugin {
  const installRewrite = (middlewares: Connect.Server) => {
    middlewares.use((request, _response, next) => {
      if (request.url === "/ios" || request.url === "/ios/") {
        request.url = "/index.html";
      }
      next();
    });
  };

  return {
    name: "miusix-ios-reference-page",
    configureServer(server) {
      installRewrite(server.middlewares);
    },
    configurePreviewServer(server) {
      installRewrite(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), iosReferencePage()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  }
});
