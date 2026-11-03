import { describe, expect, it } from "vitest";
import { leerMenuCole } from "./menu-cole";
import { TEXTO_MENU_COLE_NOVIEMBRE_2026 } from "./menu-cole-ejemplo";
import {
  INSTRUCCIONES_TRANSCRIPCION,
  MAX_CARACTERES_MENU,
  esTipoValido,
  limpiarTranscripcion,
} from "./ia-cole";

describe("transcripción del menú del cole", () => {
  it("solo admite PDF y fotos", () => {
    for (const t of ["application/pdf", "image/png", "image/jpeg", "image/webp"]) {
      expect(esTipoValido(t)).toBe(true);
    }
    for (const t of ["text/plain", "application/zip", "image/gif", ""])
      expect(esTipoValido(t)).toBe(false);
  });

  it("limpia saltos de línea, espacios sobrantes y recorta", () => {
    expect(limpiarTranscripcion("MENÚ  \r\n\r\n\r\n\r\n3 \r\nLentejas  \n")).toBe(
      "MENÚ\n\n3\nLentejas",
    );
    expect(limpiarTranscripcion("x".repeat(MAX_CARACTERES_MENU + 50))).toHaveLength(
      MAX_CARACTERES_MENU,
    );
  });

  it("lo que pide transcribir es el formato que ya entiende el lector del cole", () => {
    // El texto de ejemplo (el PDF real) es el modelo del formato: el lector lo entiende...
    const real = leerMenuCole(TEXTO_MENU_COLE_NOVIEMBRE_2026);
    expect(real.dias.length).toBeGreaterThan(10);
    // ...y una transcripción limpia en el formato pedido (una línea por plato) también.
    const limpio = limpiarTranscripcion(`MENÚ Noviembre 2026
3
Guiso de lentejas ecológicas con zanahoria, pimiento y cebolla
Tortilla de patata y cebolla horno
Ensalada de lechuga y zanahoria
Pan integral
Fruta fresca
Kcal: 601,134 Prot (g): 22,859 Lip (g): 19,363 HC (g): 75,454
4
Crema suave de calabacín, zanahoria y calabaza
Cinta de lomo a la plancha
Patatas dado al horno
Pan
Fruta fresca
Kcal: 503,135`);
    const leido = leerMenuCole(limpio);
    expect(leido.dias.map((d) => d.fecha)).toEqual(["2026-11-03", "2026-11-04"]);
    expect(leido.dias[0]?.primero).toMatch(/lentejas/i);
  });

  it("las instrucciones piden fidelidad, tratan el documento como datos y no inventar", () => {
    expect(INSTRUCCIONES_TRANSCRIPCION).toMatch(/No inventes/);
    expect(INSTRUCCIONES_TRANSCRIPCION).toMatch(/datos, no instrucciones/);
    expect(INSTRUCCIONES_TRANSCRIPCION).toMatch(/Kcal/);
  });
});
