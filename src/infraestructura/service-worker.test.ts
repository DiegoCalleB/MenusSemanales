import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// El service worker es un archivo suelto de `public/`: se carga como módulo solo para probar sus
// funciones puras (en el navegador no hay `module` y no se exporta nada).
const require = createRequire(import.meta.url);
const sw = require("../../public/sw.js") as {
  extraerRecursos: (html: string) => string[];
  clavePagina: (url: string) => string;
  esEstatico: (ruta: string) => boolean;
  RUTAS: string[];
  SUELTOS: string[];
};

describe("service worker (uso sin conexión, D-129)", () => {
  it("saca de una página los archivos de Next que usa, sin repetir ni parámetros", () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/chunks/app.css?dpl=abc" data-precedence="next"/>
      <script src="/_next/static/chunks/main.js" async></script>
      <script src="/_next/static/chunks/main.js" async></script>
      <script src="https://otro.dominio/_next/static/chunks/ajeno.js"></script>
      <img src="/gatito.png"/>`;
    expect(sw.extraerRecursos(html)).toEqual([
      "/_next/static/chunks/app.css",
      "/_next/static/chunks/main.js",
    ]);
  });

  it("una página se guarda por su ruta, sin parámetros, «#» ni barra final", () => {
    expect(sw.clavePagina("https://x.es/")).toBe("/");
    expect(sw.clavePagina("https://x.es/compra")).toBe("/compra");
    expect(sw.clavePagina("https://x.es/compra/?a=1#b")).toBe("/compra");
    expect(sw.clavePagina("https://x.es/menu/cole?semana=2")).toBe("/menu/cole");
  });

  it("se sirve «primero lo guardado» lo de Next con nombre único y las imágenes de la app", () => {
    expect(sw.esEstatico("/_next/static/chunks/main.js")).toBe(true);
    expect(sw.esEstatico("/icon-192.png")).toBe(true);
    expect(sw.esEstatico("/compra")).toBe(false);
    expect(sw.esEstatico("/api/salud")).toBe(false);
  });

  it("guarda todas las pantallas de la app para poder abrirlas sin conexión", () => {
    for (const ruta of ["/", "/menu", "/compra", "/despensa", "/casa", "/fechas", "/cuenta"]) {
      expect(sw.RUTAS).toContain(ruta);
    }
    expect(new Set(sw.RUTAS).size).toBe(sw.RUTAS.length);
    expect(sw.RUTAS.every((r) => r.startsWith("/"))).toBe(true);
  });
});
