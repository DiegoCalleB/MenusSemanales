import { describe, expect, it } from "vitest";
import {
  type Buscable,
  TIPOS_DE_FECHAS,
  agruparPorTipo,
  buscar,
  normalizar,
  puntuar,
} from "./busqueda";

const b = (o: Partial<Buscable> & { titulo: string }): Buscable => ({
  id: o.titulo,
  tipo: "plato",
  emoji: "🍽️",
  href: "/menu/platos",
  ...o,
});

describe("buscador (D-177)", () => {
  it("normaliza: sin tildes, sin mayúsculas, sin signos", () => {
    expect(normalizar("  ¡Pastel DE Calabaza,  ÁNGEL! ")).toBe("pastel de calabaza angel");
    expect(normalizar("Ñoquis")).toBe("noquis"); // así «noquis» también lo encuentra
  });

  it("encuentra sin tildes ni mayúsculas y con varias palabras (todas tienen que estar)", () => {
    const e = [
      b({ titulo: "Crema de calabacín" }),
      b({ titulo: "Pollo asado con patatas" }),
      b({ titulo: "Calabacín relleno" }),
    ];
    expect(
      buscar(e, "CALABACIN")
        .map((x) => x.titulo)
        .sort(),
    ).toEqual(["Calabacín relleno", "Crema de calabacín"]);
    expect(buscar(e, "crema calabacin").map((x) => x.titulo)).toEqual(["Crema de calabacín"]);
    expect(buscar(e, "pollo calabacin")).toEqual([]);
  });

  it("encuentra por el principio de una palabra y por el detalle o el texto extra", () => {
    const e = [
      b({
        titulo: "ITV del coche",
        tipo: "papel",
        detalle: "vence en 12 días",
        extra: "Seat Ibiza",
      }),
    ];
    expect(buscar(e, "itv")).toHaveLength(1);
    expect(buscar(e, "coch")).toHaveLength(1);
    expect(buscar(e, "ibiza")).toHaveLength(1);
    expect(buscar(e, "días")).toHaveLength(1);
    // Con una sola letra o vacío no busca.
    expect(buscar(e, "i")).toEqual([]);
    expect(buscar(e, "   ")).toEqual([]);
  });

  it("lo que coincide mejor va primero: título exacto, palabra entera, principio, dentro", () => {
    const e = [
      b({ titulo: "Sopa de fideos" }),
      b({ titulo: "Fideos" }),
      b({ titulo: "Los fideuás" }),
      b({ titulo: "Arroz", extra: "con fideos" }),
    ];
    expect(buscar(e, "fideos").map((x) => x.titulo)).toEqual(["Fideos", "Sopa de fideos", "Arroz"]);
    expect(puntuar(e[1]!, ["fideos"])).toBeGreaterThan(puntuar(e[3]!, ["fideos"]));
  });

  it("si empatan, lo que viene antes que lo ya pasado", () => {
    const e = [
      b({ titulo: "Pediatra", tipo: "cita", fecha: "2026-10-01" }),
      b({ titulo: "Pediatra", id: "b", tipo: "cita", fecha: "2026-12-10" }),
      b({ titulo: "Pediatra", id: "c", tipo: "cita", fecha: "2026-11-20" }),
    ];
    expect(buscar(e, "pediatra", { hoy: "2026-11-17" }).map((x) => x.fecha)).toEqual([
      "2026-11-20",
      "2026-12-10",
      "2026-10-01",
    ]);
  });

  it("puede limitarse a unos tipos (la caja de Fechas) y se agrupa por tipo", () => {
    const e = [
      b({ titulo: "Dentista", tipo: "cita" }),
      b({ titulo: "Dentista de Alba", id: "p", tipo: "papel" }),
      b({ titulo: "Dentífrico", id: "c", tipo: "compra" }),
    ];
    expect(
      buscar(e, "dent", { tipos: TIPOS_DE_FECHAS })
        .map((x) => x.tipo)
        .sort(),
    ).toEqual(["cita", "papel"]);
    const g = agruparPorTipo(buscar(e, "dent"));
    expect(g.map((x) => x.tipo.id)).toEqual(["cita", "papel", "compra"]);
  });
});
