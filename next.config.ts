import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Banco local (PGlite, só em desenvolvimento/testes) carrega WASM — não empacotar.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        // Service worker das notificações: sempre a versão mais nova.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
