import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Menús Semanales",
    short_name: "Menús",
    description: "Planificador de menús, despensa y lista de la compra para toda la familia.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#fff7f2",
    theme_color: "#c72a63",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
