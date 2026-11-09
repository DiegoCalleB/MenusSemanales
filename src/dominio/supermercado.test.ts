import { describe, expect, it } from "vitest";
import { SUPERMERCADOS, enlaceDeBusqueda, terminoDeBusqueda } from "./supermercado";

const mercadona = SUPERMERCADOS.find((s) => s.id === "mercadona")!;

describe("pasar la lista al supermercado", () => {
  it("busca por el nombre del artículo, sin lo que va entre paréntesis", () => {
    expect(terminoDeBusqueda("Pollo (pechuga)")).toBe("Pollo");
    expect(terminoDeBusqueda("  Leche   entera ")).toBe("Leche entera");
    expect(terminoDeBusqueda("(solo paréntesis)")).toBe("");
  });

  it("recorta los nombres larguísimos", () => {
    expect(terminoDeBusqueda("a".repeat(200))).toHaveLength(60);
  });

  it("la dirección de Mercadona lleva el término codificado", () => {
    expect(enlaceDeBusqueda(mercadona, "Leche")).toBe(
      "https://tienda.mercadona.es/search-results?query=Leche",
    );
    expect(enlaceDeBusqueda(mercadona, "Pimientos & cebollas (rojos)")).toBe(
      "https://tienda.mercadona.es/search-results?query=Pimientos%20%26%20cebollas",
    );
  });

  it("solo enlaza a páginas https de la propia tienda", () => {
    for (const s of SUPERMERCADOS) {
      expect(s.tienda.startsWith("https://")).toBe(true);
      expect(enlaceDeBusqueda(s, "x").startsWith(s.tienda)).toBe(true);
    }
  });
});
