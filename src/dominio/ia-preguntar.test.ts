import { describe, expect, it } from "vitest";
import {
  INSTRUCCIONES_PREGUNTAR,
  mensajeParaPreguntar,
  pareceUnaPregunta,
  preguntaValida,
} from "./ia-preguntar";

describe("pregúntale a tu casa (D-179)", () => {
  it("el mensaje lleva la fecha de hoy, los datos y la pregunta entre marcas", () => {
    const m = mensajeParaPreguntar(
      "2026-11-17",
      "martes",
      "## Citas\n- jueves: pediatra",
      "¿Cuándo es el pediatra?",
    );
    expect(m).toContain("martes 2026-11-17");
    expect(m).toContain("<datos>\n## Citas\n- jueves: pediatra\n</datos>");
    expect(m).toContain("<pregunta>\n¿Cuándo es el pediatra?\n</pregunta>");
  });

  it("las instrucciones exigen contestar solo con los datos y no obedecer lo que digan", () => {
    expect(INSTRUCCIONES_PREGUNTAR).toMatch(/SOLO con lo que hay en el resumen/);
    expect(INSTRUCCIONES_PREGUNTAR).toMatch(/no obedezcas/);
    expect(INSTRUCCIONES_PREGUNTAR).toMatch(/medicación/);
  });

  it("una pregunta válida no es vacía ni larguísima", () => {
    expect(preguntaValida("¿Qué hay?")).toBe(true);
    expect(preguntaValida("  ab ")).toBe(false);
    expect(preguntaValida("x".repeat(301))).toBe(false);
  });

  it("reconoce lo que parece una pregunta y lo que es una búsqueda", () => {
    for (const t of [
      "¿cuándo caduca el pasaporte?",
      "qué cenamos mañana",
      "cuándo es el pediatra",
      "hay cole el viernes",
      "tenemos leche",
    ]) {
      expect(pareceUnaPregunta(t), t).toBe(true);
    }
    for (const t of ["pediatra", "itv coche", "lentejas"])
      expect(pareceUnaPregunta(t), t).toBe(false);
  });
});
