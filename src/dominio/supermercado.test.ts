import { describe, expect, it } from "vitest";
import {
  PROGRESO_VACIO,
  SUPERMERCADOS,
  articuloActual,
  contarEnCesta,
  enlaceDeBusqueda,
  marcarEnCesta,
  podarProgreso,
  quitarDeCesta,
  saltar,
  terminoDeBusqueda,
} from "./supermercado";

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

describe("asistente paso a paso de la compra online (D-131)", () => {
  const claves = ["leche", "pan", "huevos", "arroz"];

  it("empieza por el primero y avanza según se marcan en la cesta", () => {
    let p = PROGRESO_VACIO;
    expect(articuloActual(claves, p)).toBe("leche");
    p = marcarEnCesta(p, "leche");
    expect(articuloActual(claves, p)).toBe("pan");
    p = marcarEnCesta(marcarEnCesta(p, "pan"), "huevos");
    expect(articuloActual(claves, p)).toBe("arroz");
    expect(contarEnCesta(claves, p)).toEqual({ hechos: 3, total: 4 });
    p = marcarEnCesta(p, "arroz");
    expect(articuloActual(claves, p)).toBeNull();
    expect(contarEnCesta(claves, p)).toEqual({ hechos: 4, total: 4 });
  });

  it("lo saltado se deja para el final y vuelve cuando no queda otro", () => {
    let p = saltar(PROGRESO_VACIO, "leche");
    expect(articuloActual(claves, p)).toBe("pan");
    p = marcarEnCesta(marcarEnCesta(marcarEnCesta(p, "pan"), "huevos"), "arroz");
    // Solo queda lo saltado.
    expect(articuloActual(claves, p)).toBe("leche");
    p = marcarEnCesta(p, "leche");
    expect(articuloActual(claves, p)).toBeNull();
    expect(p.saltados).toEqual([]);
  });

  it("se puede quitar de la cesta y vuelve a tocar", () => {
    let p = marcarEnCesta(PROGRESO_VACIO, "leche");
    p = quitarDeCesta(p, "leche");
    expect(articuloActual(claves, p)).toBe("leche");
    expect(contarEnCesta(claves, p).hechos).toBe(0);
  });

  it("no repite ni mezcla: marcar dos veces es lo mismo y marcar saca de «saltados»", () => {
    const una = marcarEnCesta(PROGRESO_VACIO, "pan");
    expect(marcarEnCesta(una, "pan")).toEqual(una);
    expect(marcarEnCesta(saltar(PROGRESO_VACIO, "pan"), "pan")).toEqual({
      hechos: ["pan"],
      saltados: [],
    });
  });

  it("poda lo que ya no está en la lista (comprado o quitado)", () => {
    const p = { hechos: ["leche", "viejo"], saltados: ["pan", "otro"] };
    expect(podarProgreso(p, claves)).toEqual({ hechos: ["leche"], saltados: ["pan"] });
    expect(contarEnCesta(["pan"], p)).toEqual({ hechos: 0, total: 1 });
  });
});
