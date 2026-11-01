import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Menús Semanales", template: "%s · Menús Semanales" },
  description: "Planificador de menús, despensa y lista de la compra para toda la familia.",
  applicationName: "Menús Semanales",
  appleWebApp: { capable: true, title: "Menús", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#2a2027" },
  ],
  width: "device-width",
  initialScale: 1,
  // Ocupa también la zona de la muesca del iPhone; la interfaz respeta las áreas seguras.
  viewportFit: "cover",
  // No se bloquea el zoom: quien lo necesita puede ampliar (WCAG 1.4.4).
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Renderizado dinámico obligatorio: la CSP lleva un nonce distinto en cada petición y Next solo
  // puede aplicarlo al renderizar en el servidor (ver D-025).
  await connection();
  return (
    <html lang="es" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
