import { describe, expect, it } from "vitest";
import {
  PROGRESO_VACIO,
  SUPERMERCADOS,
  articuloActual,
  contarEnCesta,
  enlaceDeBusqueda,
  enlaceDeProducto,
  extraerEnlace,
  marcarEnCesta,
  nombreDeProducto,
  revisarEnlaceDeProducto,
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

describe("recordar el producto elegido (D-132)", () => {
  it("saca el enlace de un texto pegado al compartir", () => {
    expect(extraerEnlace("Mira esto: https://tienda.mercadona.es/product/1/x ¡rico!")).toBe(
      "https://tienda.mercadona.es/product/1/x",
    );
    expect(extraerEnlace("sin enlace")).toBeNull();
  });

  it("acepta solo un enlace https de la tienda, y lo deja limpio", () => {
    const m = mercadona;
    const bueno = "https://tienda.mercadona.es/product/10409/leche-entera-hacendado";
    expect(enlaceDeProducto(m, bueno)).toBe(bueno);
    expect(enlaceDeProducto(m, `  ${bueno}/?utm=a&lang=es#fotos `)).toBe(bueno);
    expect(enlaceDeProducto(m, `Mira este producto ${bueno} !`)).toBe(bueno);
  });

  it("vale la web de la empresa y sus subdominios, y sube un http a https", () => {
    const m = mercadona;
    expect(enlaceDeProducto(m, "http://tienda.mercadona.es/product/1/x")).toBe(
      "https://tienda.mercadona.es/product/1/x",
    );
    expect(enlaceDeProducto(m, "https://www.mercadona.es/product/1/x?a=b")).toBe(
      "https://www.mercadona.es/product/1/x",
    );
    expect(enlaceDeProducto(m, "https://TIENDA.Mercadona.es/product/1/x")).toBe(
      "https://tienda.mercadona.es/product/1/x",
    );
  });

  it("rechaza lo que no es un producto de la tienda, y dice por qué", () => {
    const m = mercadona;
    const motivo = (t: string) => {
      const r = revisarEnlaceDeProducto(m, t);
      return r.ok ? "OK" : r.motivo;
    };
    for (const malo of ["", "leche", "javascript:alert(1)", "ftp://tienda.mercadona.es/x"]) {
      expect(motivo(malo)).toBe("no-es-enlace");
    }
    for (const otro of [
      "https://otro.es/product/1/x",
      "https://tienda.mercadona.es.malo.com/product/1/x", // dominio parecido
      "https://malomercadona.es/product/1/x", // acaba igual pero no es un subdominio
    ]) {
      expect(motivo(otro)).toBe("otro-sitio");
    }
    expect(motivo("https://tienda.mercadona.es/")).toBe("portada");
    expect(motivo("https://tienda.mercadona.es")).toBe("portada");
    expect(motivo("https://tienda.mercadona.es/search-results?query=leche")).toBe("busqueda");
    // Y dice de qué sitio era, para poder explicárselo a la persona.
    expect(revisarEnlaceDeProducto(m, "https://otro.es/x")).toEqual({
      ok: false,
      motivo: "otro-sitio",
      host: "otro.es",
    });
    expect(enlaceDeProducto(m, "https://otro.es/x")).toBeNull();
  });

  it("pone un nombre legible al enlace", () => {
    expect(
      nombreDeProducto("https://tienda.mercadona.es/product/10409/leche-entera-hacendado"),
    ).toBe("Leche entera hacendado");
    expect(nombreDeProducto("https://tienda.mercadona.es/product/10409")).toBe("Producto guardado");
    expect(nombreDeProducto("nada")).toBe("Producto guardado");
  });
});
