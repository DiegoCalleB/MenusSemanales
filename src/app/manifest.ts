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
    // Compartir desde otra app (WhatsApp, Galería…) con «¡Hecho!» (D-138).
    share_target: {
      action: "/compartir-recibido",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "archivo", accept: ["image/*", "application/pdf"] }],
      },
    },
    // Atajos al mantener pulsado el icono (D-210): lo que más se hace con las manos ocupadas.
    shortcuts: [
      {
        name: "Añadir a la compra",
        short_name: "Compra",
        url: "/compra?anadir=1",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Apuntar una fecha",
        short_name: "Fecha",
        url: "/fechas?apuntar=1",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
