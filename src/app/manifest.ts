import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Menús Semanales",
    short_name: "Menús",
    description: "Planificador de menús, despensa y lista de la compra para toda la familia.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#9e4f4f",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
