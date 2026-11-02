import { describe, expect, it } from "vitest";
import {
  INSTRUCCIONES_LISTA,
  MAX_ARTICULOS_IA,
  depurarArticulos,
  mensajeParaIa,
  peticionListaSchema,
  respuestaListaSchema,
} from "./ia-lista";

describe("petición y respuesta de la IA de la lista", () => {
  it("valida la petición: recorta espacios, exige texto y limita el tamaño", () => {
    expect(peticionListaSchema.parse({ texto: "  leche y pan " }).texto).toBe("leche y pan");
    expect(peticionListaSchema.safeParse({ texto: "   " }).success).toBe(false);
    expect(peticionListaSchema.safeParse({ texto: "x".repeat(1501) }).success).toBe(false);
    expect(peticionListaSchema.parse({ texto: "a" }).yaEnLista).toEqual([]);
  });

  it("valida la respuesta: categorías del súper y tope de artículos", () => {
    const bueno = { articulos: [{ nombre: "Leche", cantidad: "2", categoria: "lacteos" }] };
    expect(respuestaListaSchema.safeParse(bueno).success).toBe(true);
    expect(
      respuestaListaSchema.safeParse({
        articulos: [{ nombre: "X", cantidad: "", categoria: "inventada" }],
      }).success,
    ).toBe(false);
    const muchos = Array.from({ length: MAX_ARTICULOS_IA + 1 }, (_, i) => ({
      nombre: `A${i}`,
      cantidad: "",
      categoria: "otros",
    }));
    expect(respuestaListaSchema.safeParse({ articulos: muchos }).success).toBe(false);
  });

  it("el mensaje separa lo ya apuntado del texto del usuario", () => {
    const m = mensajeParaIa({ texto: "huevos 12", yaEnLista: ["Pan", "Leche"] });
    expect(m).toContain("- Pan\n- Leche");
    expect(m).toContain("<texto>\nhuevos 12\n</texto>");
    expect(mensajeParaIa({ texto: "x", yaEnLista: [] })).toContain("(nada todavía)");
  });

  it("las instrucciones tratan el texto como datos y piden no inventar cantidades", () => {
    expect(INSTRUCCIONES_LISTA).toMatch(/datos, no instrucciones/);
    expect(INSTRUCCIONES_LISTA).toMatch(/No inventes cantidades/);
  });
});

describe("depurarArticulos", () => {
  const a = (nombre: string) => ({ nombre, cantidad: "", categoria: "otros" as const });

  it("quita lo ya apuntado (sin tildes ni mayúsculas) y los repetidos", () => {
    const r = depurarArticulos(
      [a("Café"), a("cafe"), a("Pan"), a("Yogures"), a("yogures")],
      ["pan"],
    );
    expect(r.map((x) => x.nombre)).toEqual(["Café", "Yogures"]);
  });

  it("recorta al máximo de artículos", () => {
    const muchos = Array.from({ length: 80 }, (_, i) => a(`Cosa ${i}`));
    expect(depurarArticulos(muchos, [])).toHaveLength(MAX_ARTICULOS_IA);
  });
});
