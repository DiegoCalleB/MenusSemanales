import { describe, expect, it } from "vitest";
import {
  type Canje,
  clavePremio,
  costeValido,
  estrellasGanadas,
  idDePremioDeEjemplo,
  insigniasDe,
  mejorRacha,
  rachaActual,
  premiosDeEjemplo,
  saldoDeEstrellas,
} from "./premios";
import type { FechaIso } from "./fechas";
import type { Tarea } from "./tareas";

const tarea = (personaId: string, hechas: string[]): Tarea => ({
  id: `${personaId}-${hechas.length}`,
  personaId,
  texto: "x",
  frecuencia: "diaria",
  hechas: hechas as Tarea["hechas"],
});
const canje = (personaId: string, coste: number): Canje => ({
  id: `c${coste}`,
  premioId: null,
  nombre: "Algo",
  coste,
  personaId,
  fecha: "2026-11-04",
});

describe("estrellas", () => {
  it("una por cada día en que se hizo cada tarea, de esa persona", () => {
    const t = [
      tarea("alba", ["2026-11-02", "2026-11-03"]),
      tarea("alba", ["2026-11-03"]),
      tarea("emma", ["2026-11-03"]),
    ];
    expect(estrellasGanadas(t, "alba")).toBe(3);
    expect(estrellasGanadas(t, "emma")).toBe(1);
  });

  it("el saldo resta lo canjeado y nunca baja de cero", () => {
    const t = [tarea("alba", ["2026-11-02", "2026-11-03", "2026-11-04"])];
    expect(saldoDeEstrellas(t, [canje("alba", 2), canje("emma", 9)], "alba")).toBe(1);
    expect(saldoDeEstrellas(t, [canje("alba", 8)], "alba")).toBe(0);
  });
});

describe("premios", () => {
  it("el coste va de 1 a 99 y es entero", () => {
    expect([0, 1, 99, 100, 2.5].map(costeValido)).toEqual([false, true, true, false, false]);
  });

  it("el id de un premio de ejemplo es estable y no depende de mayúsculas ni tildes", () => {
    expect(idDePremioDeEjemplo("Postre ESPECIAL")).toBe(idDePremioDeEjemplo("postre especial"));
    expect(clavePremio("  Elegir  la peli ")).toBe("elegir la peli");
    const ids = premiosDeEjemplo().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("rachas e insignias", () => {
  const hechas = (...d: string[]) => [tarea("alba", d)];

  it("la racha cuenta días seguidos y no se rompe hasta que acabe hoy", () => {
    const t = hechas("2026-11-02", "2026-11-03");
    expect(rachaActual(t, "alba", "2026-11-04" as FechaIso)).toBe(2); // hoy aún sin hacer
    expect(rachaActual(t, "alba", "2026-11-03" as FechaIso)).toBe(2);
    expect(rachaActual(t, "alba", "2026-11-06" as FechaIso)).toBe(0); // se rompió
    expect(rachaActual(t, "emma", "2026-11-04" as FechaIso)).toBe(0);
  });

  it("varias tareas el mismo día cuentan un día; la mejor racha es la más larga", () => {
    const t = [
      ...hechas("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-10"),
      tarea("alba", ["2026-10-02"]),
    ];
    expect(mejorRacha(t, "alba")).toBe(3);
  });

  it("las insignias salen de las estrellas y de la mejor racha", () => {
    const dias = Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`);
    const conseguidas = insigniasDe(hechas(...dias), "alba")
      .filter((i) => i.conseguida)
      .map((i) => i.id);
    expect(conseguidas).toEqual(["primera", "racha3", "racha7"]);
    expect(insigniasDe([], "alba").some((i) => i.conseguida)).toBe(false);
  });
});
