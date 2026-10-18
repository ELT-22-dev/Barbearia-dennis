import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Banco local (PGlite, só em desenvolvimento/testes) carrega WASM — não empacotar.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
