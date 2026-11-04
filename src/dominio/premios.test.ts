import { describe, expect, it } from "vitest";
import {
  type Canje,
  clavePremio,
  costeValido,
  estrellasGanadas,
  idDePremioDeEjemplo,
  premiosDeEjemplo,
  saldoDeEstrellas,
} from "./premios";
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
