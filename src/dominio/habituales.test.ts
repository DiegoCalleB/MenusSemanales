import { describe, expect, it } from "vitest";
import {
  CATEGORIAS,
  HABITUALES,
  NOMBRE_CATEGORIA,
  claveArticulo,
  clasificarArticulo,
  habitualesPorCategoria,
  partirDictado,
  sugerencias,
} from "./habituales";

describe("clasificarArticulo con la lista real de la familia", () => {
  it.each([
    ["Leche fresca desnatada", "lacteos"],
    ["Kéfir x2", "lacteos"],
    ["Queso rallado sin lactosa", "lacteos"],
    ["Huevos 12", "huevos"],
    ["Pan rodajas", "panaderia"],
    ["Piadinas 3 paquetes", "panaderia"],
    ["Pañales", "higiene"],
    ["Pasta de dientes Alba", "higiene"],
    ["Papel higiénico", "higiene"],
    ["Tissues cole", "higiene"],
    ["Papilla Emma", "higiene"],
    ["Latas de gatos", "mascotas"],
    ["comida húmeda de gatos", "mascotas"],
    ["Cervezas sin alcohol", "bebidas"],
    ["Cocacola 00", "bebidas"],
    ["Hielos", "bebidas"],
    ["Detergente lavavajillas", "limpieza"],
    ["rollos de papel de cocina", "limpieza"],
    ["Bolsas basura blancas", "limpieza"],
    ["Pilas botón", "limpieza"],
    ["Taquitos de jamón", "carne"],
    ["Pollo filete fino", "carne"],
    ["Fuet", "carne"],
    ["Lubina", "pescado"],
    ["Atún natural", "pescado"],
    ["Judías verdes", "fruta_verdura"],
    ["Tomates ensalada 4", "fruta_verdura"],
    ["Plátanos", "fruta_verdura"],
    ["Tomate frito", "conservas"],
    ["Hummus", "conservas"],
    ["Arroz 1 minuto integral", "despensa"],
    ["Galletas María", "despensa"],
    ["Café en grano", "despensa"],
    ["Aceite de oliva", "despensa"],
    ["2 pizzas (barbacoa, 4 quesos)", "congelados"],
    ["Cosa rara que no existe", "otros"],
  ])("%s → %s", (nombre, categoria) => {
    expect(clasificarArticulo(nombre)).toBe(categoria);
  });

  it("todas las categorías tienen nombre y emoji", () => {
    for (const c of CATEGORIAS) {
      expect(NOMBRE_CATEGORIA[c].nombre).not.toBe("");
      expect(NOMBRE_CATEGORIA[c].emoji).not.toBe("");
    }
  });
});

describe("partirDictado", () => {
  it("separa por comas, «y», punto y coma y saltos de línea, y pone mayúscula", () => {
    expect(partirDictado("leche, huevos y pan")).toEqual(["Leche", "Huevos", "Pan"]);
    expect(partirDictado("pañales;kéfir\nplátanos")).toEqual(["Pañales", "Kéfir", "Plátanos"]);
    expect(partirDictado("- yogures\n☐ pollo")).toEqual(["Yogures", "Pollo"]);
  });
  it("no repite (ignorando tildes y mayúsculas), ignora vacíos y limita a 20", () => {
    expect(partirDictado("Leche, leche, LECHE ,,  ")).toEqual(["Leche"]);
    expect(partirDictado("Kéfir y kefir")).toEqual(["Kéfir"]);
    expect(partirDictado(Array.from({ length: 50 }, (_, i) => `art${i}`).join(","))).toHaveLength(
      20,
    );
    expect(partirDictado("   ")).toEqual([]);
  });
  it("no parte palabras que contienen «y» ni lo hace al final", () => {
    expect(partirDictado("Yogur y")).toEqual(["Yogur y"]);
    expect(partirDictado("Hay yogures")).toEqual(["Hay yogures"]);
  });
});

describe("sugerencias de lo de siempre", () => {
  it("propone habituales que empiezan por lo escrito y que aún no están", () => {
    expect(sugerencias("pa", new Set())).toEqual(expect.arrayContaining(["Pan", "Pañales"]));
    expect(sugerencias("pa", new Set([claveArticulo("Pan")]))).not.toContain("Pan");
    expect(sugerencias("kef", new Set())).toEqual(["Kéfir"]);
    expect(sugerencias("l", new Set())).toEqual([]); // hace falta al menos 2 letras
    expect(sugerencias("zzzz", new Set())).toEqual([]);
  });
  it("los habituales no tienen duplicados", () => {
    expect(new Set(HABITUALES.map(claveArticulo)).size).toBe(HABITUALES.length);
  });
});

describe("habitualesPorCategoria", () => {
  it("agrupa todos los habituales por sección, en orden de tienda y sin perder ninguno", () => {
    const grupos = habitualesPorCategoria();
    expect(grupos.flatMap((g) => g.articulos).sort()).toEqual([...HABITUALES].sort());
    const orden = grupos.map((g) => CATEGORIAS.indexOf(g.categoria));
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
    expect(grupos.find((g) => g.categoria === "lacteos")?.articulos).toContain("Kéfir");
    expect(grupos.find((g) => g.categoria === "higiene")?.articulos).toContain("Pañales");
    expect(grupos.every((g) => g.articulos.length > 0)).toBe(true);
  });
});
