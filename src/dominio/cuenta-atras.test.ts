import { describe, expect, it } from "vitest";
import type { Cumple } from "./cumples";
import { cuentaAtras } from "./cuenta-atras";

const c = (extra: Partial<Cumple>): Cumple => ({
  id: "a",
  nombre: "Ana",
  dia: 7,
  mes: 11,
  anio: 1985,
  relacion: "familia",
  ideas: [],
  estado: "sin-pensar",
  ...extra,
});

describe("cuentaAtras", () => {
  it("mezcla cumpleaños y eventos, ordenados por cercanía, con la edad", () => {
    const r = cuentaAtras(
      [c({}), c({ id: "b", nombre: "Emma", dia: 20, mes: 11, anio: 2021 })],
      { "2026-11-05": { titulo: "Excursión", emoji: "🥾" } },
      "2026-11-02",
    );
    expect(r.map((x) => [x.titulo, x.dias, x.texto])).toEqual([
      ["Excursión", 3, "3 días"],
      ["Ana (41)", 5, "5 días"],
      ["Emma (5)", 18, "18 días"],
    ]);
  });
  it("deja fuera lo lejano, lo pasado y el propio día del cumple, y limita cuántos salen", () => {
    expect(cuentaAtras([c({ dia: 2 })], {}, "2026-11-02")).toEqual([]);
    expect(cuentaAtras([c({ dia: 20, mes: 3 })], {}, "2026-11-02")).toEqual([]);
    expect(cuentaAtras([], { "2026-11-01": { titulo: "Ayer", emoji: "x" } }, "2026-11-02")).toEqual(
      [],
    );
    const muchos = Object.fromEntries(
      [3, 4, 5, 6, 7].map((d) => [`2026-11-0${d}`, { titulo: `E${d}`, emoji: "📌" }]),
    );
    expect(cuentaAtras([], muchos, "2026-11-02")).toHaveLength(3);
    expect(
      cuentaAtras([], { "2026-11-03": { titulo: "Mañana", emoji: "x" } }, "2026-11-02")[0]?.texto,
    ).toBe("mañana");
  });

  it("suma los eventos de Google, sin repetir los cumpleaños que ya tenemos", () => {
    const r = cuentaAtras([c({})], {}, "2026-11-02", {
      externos: [
        { fecha: "2026-11-04", titulo: "Reunión del cole", hora: "17:00" },
        { fecha: "2026-11-07", titulo: "Cumpleaños de Ana", hora: null },
        { fecha: "2026-11-03", titulo: "Pasado de rango", hora: null },
      ],
    });
    expect(r.map((x) => [x.emoji, x.titulo, x.dias])).toEqual([
      ["📅", "Pasado de rango", 1],
      ["📅", "Reunión del cole (17:00)", 2],
      ["🎂", "Ana (41)", 5],
    ]);
  });
});
