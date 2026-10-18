import type { MetadataRoute } from "next";

// Permite "Adicionar à tela inicial" (celular) e "Instalar app" (desktop).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Barbearia Dennis",
    short_name: "Barbearia",
    description: "Controle de atendimentos e divisão 50/50 da barbearia.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f6f2",
    theme_color: "#f8f6f2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
