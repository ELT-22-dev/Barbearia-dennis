import type { Metadata, Viewport } from "next";
import { Figtree, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-figtree" });
const outfit = Outfit({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: { default: "Barbearia", template: "%s — Barbearia" },
  description: "Controle de atendimentos e divisão 50/50 da barbearia.",
  openGraph: { type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${figtree.variable} ${outfit.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
