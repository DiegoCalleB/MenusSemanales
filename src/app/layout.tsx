import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Menús Semanales", template: "%s · Menús Semanales" },
  description: "Planificador de menús, despensa y lista de la compra para toda la familia.",
  applicationName: "Menús Semanales",
  appleWebApp: { capable: true, title: "Menús", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#9e4f4f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
