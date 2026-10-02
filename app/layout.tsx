import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal de Proveedores — Auditoría Interna",
  description: "Entorno privado para auditar el flujo del portal de proveedores.",
  robots: { index: false, follow: false, nocache: true },
  other: { "codex-preview": "development" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}