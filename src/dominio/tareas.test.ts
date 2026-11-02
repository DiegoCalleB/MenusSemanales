import { describe, expect, it } from "vitest";
import { type Tarea, alternarTarea, estaHecha, resumenDeTareas, tareasDeHoy } from "./tareas";

const t = (extra: Partial<Tarea> = {}): Tarea => ({
  id: "t",
  personaId: "alba",
  texto: "Dientes",
  frecuencia: "diaria",
  hechas: [],
  ...extra,
});

describe("tareas por persona", () => {
  it("una diaria se marca hoy y mañana vuelve a estar pendiente", () => {
    const hecha = alternarTarea(t(), "2026-11-02");
    expect(estaHecha(hecha, "2026-11-02")).toBe(true);
    expect(estaHecha(hecha, "2026-11-03")).toBe(false);
    expect(alternarTarea(hecha, "2026-11-02").hechas).toEqual([]);
    // Marcarla otro día conserva el historial.
    expect(alternarTarea(hecha, "2026-11-03").hechas).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("una puntual se hace una sola vez y se puede desmarcar", () => {
    const p = t({ frecuencia: "puntual", texto: "Examen" });
    const hecha = alternarTarea(p, "2026-11-02");
    expect(estaHecha(hecha, "2026-11-05")).toBe(true);
    expect(alternarTarea(hecha, "2026-11-05").hechas).toEqual([]);
  });

  it("no muta la tarea original", () => {
    const original = t();
    const copia = JSON.stringify(original);
    alternarTarea(original, "2026-11-02");
    expect(JSON.stringify(original)).toBe(copia);
  });

  it("hoy se ven las diarias, las puntuales pendientes y las hechas hoy; se esconden las de otros días y las de otras personas", () => {
    const tareas = [
      t({ id: "a", frecuencia: "diaria" }),
      t({ id: "b", frecuencia: "puntual" }),
      t({ id: "c", frecuencia: "puntual", hechas: ["2026-11-02"] }),
      t({ id: "d", frecuencia: "puntual", hechas: ["2026-10-30"] }),
      t({ id: "e", personaId: "ana" }),
    ];
    expect(tareasDeHoy(tareas, "alba", "2026-11-02").map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(tareasDeHoy(tareas, "alba", "2026-11-03").map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("cuenta el progreso del día", () => {
    const tareas = [
      t({ id: "a", hechas: ["2026-11-02"] }),
      t({ id: "b" }),
      t({ id: "c", frecuencia: "puntual" }),
    ];
    expect(resumenDeTareas(tareas, "alba", "2026-11-02")).toEqual({ total: 3, hechas: 1 });
    expect(resumenDeTareas(tareas, "nadie", "2026-11-02")).toEqual({ total: 0, hechas: 0 });
  });
});
