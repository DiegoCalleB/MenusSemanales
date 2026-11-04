import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "¡Hecho!",
    short_name: "Hecho",
    description: "Menú, compra, casa y cole sin carga mental: tú descansa, yo me encargo.",
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
