import { describe, expect, it } from "vitest";
import {
  type Cuidado,
  animoDeAgua,
  cuidadoDe,
  notificacionDeCuidado,
  podarDias,
  recordatoriosDeCuidado,
  semanaDeEjercicio,
  semanasSeguidas,
  tocaEjercicio,
  validarAjustes,
} from "./cuidado";

// 2026-11-18 es miércoles; su lunes, el 16.
const HOY = "2026-11-18";
const hecho = { agua: 0, habitos: [], ejercicio: true };
const base = (dias: Cuidado["dias"], ejercicio: Cuidado["ejercicio"]): Cuidado => ({
  personaId: "a",
  metaAgua: 8,
  habitos: [],
  ejercicio,
  avisos: false,
  dias,
});

describe("cuidado", () => {
  it("parte de 8 vasos y sin nada más", () => {
    expect(cuidadoDe([], "a")).toMatchObject({ metaAgua: 8, habitos: [], ejercicio: null });
  });

  it("cuenta las sesiones de la semana y la racha de semanas", () => {
    const c = base(
      {
        "2026-11-16": hecho,
        "2026-11-18": hecho,
        "2026-11-09": hecho,
        "2026-11-11": hecho,
        "2026-11-02": hecho,
      },
      { nombre: "Correr", dias: [1, 3, 5] },
    );
    expect(semanaDeEjercicio(c, HOY)).toEqual({ hechas: 2, objetivo: 3 });
    // Ni esta semana (2 de 3) ni la anterior (2 de 3) cumplen: no hay racha.
    expect(semanasSeguidas(c, HOY)).toBe(0);
    const buena = base(
      { "2026-11-09": hecho, "2026-11-10": hecho, "2026-11-02": hecho, "2026-11-03": hecho },
      { nombre: "Correr", dias: [2, 4] },
    );
    expect(semanasSeguidas(buena, HOY)).toBe(2);
  });

  it("sabe si hoy toca ejercicio", () => {
    const c = base({}, { nombre: "Correr", dias: [3] });
    expect(tocaEjercicio(c, HOY)).toBe(true);
    expect(tocaEjercicio(c, "2026-11-19")).toBe(false);
    expect(tocaEjercicio(base({}, null), HOY)).toBe(false);
  });

  it("poda lo de hace más de cinco semanas", () => {
    const c = base({ "2026-01-01": hecho, [HOY]: hecho }, null);
    expect(Object.keys(podarDias(c, HOY).dias)).toEqual([HOY]);
  });

  it("anima sin reñir", () => {
    expect(animoDeAgua(0, 8)).toMatch(/Empieza/);
    expect(animoDeAgua(8, 8)).toMatch(/Meta cumplida/);
  });

  it("valida los ajustes", () => {
    expect(validarAjustes({ metaAgua: 0, habitos: [], ejercicio: null, avisos: false })).toBeNull();
    expect(
      validarAjustes({
        metaAgua: 8,
        habitos: ["a", "b", "c", "d", "e", "f", "g"],
        ejercicio: null,
        avisos: false,
      }),
    ).toBeNull();
    expect(
      validarAjustes({
        metaAgua: 8,
        habitos: [],
        ejercicio: { nombre: " ", dias: [2, 9] },
        avisos: true,
      }),
    ).toEqual({
      metaAgua: 8,
      habitos: [],
      ejercicio: { nombre: "Ejercicio", dias: [2] },
      avisos: true,
    });
  });

  describe("avisos del móvil (D-183)", () => {
    const personas = [{ id: "d", nombre: "Diego" }];
    // 2026-11-04 es miércoles (3).
    const hoy = "2026-11-04";
    const base = (agua: number, ejercicio = false) => [
      {
        personaId: "d",
        metaAgua: 8,
        ejercicio: { nombre: "Correr", dias: [1, 3, 5] },
        dias: [{ fecha: hoy, agua, ejercicio }],
      },
    ];

    it("recuerda el agua solo si va corto", () => {
      expect(recordatoriosDeCuidado(base(0), personas, hoy, 11)).toHaveLength(1);
      expect(recordatoriosDeCuidado(base(2), personas, hoy, 11)).toHaveLength(0);
      expect(recordatoriosDeCuidado(base(4), personas, hoy, 17)).toHaveLength(1);
      expect(recordatoriosDeCuidado(base(5), personas, hoy, 17)).toHaveLength(0);
      expect(recordatoriosDeCuidado(base(0), personas, hoy, 14)).toHaveLength(0);
    });

    it("recuerda el ejercicio a las 18 h si toca y no está hecho", () => {
      const r = recordatoriosDeCuidado(base(8), personas, hoy, 18);
      expect(r.map((x) => x.tipo)).toEqual(["ejercicio"]);
      expect(recordatoriosDeCuidado(base(8, true), personas, hoy, 18)).toHaveLength(0);
      // Jueves: no toca.
      expect(recordatoriosDeCuidado(base(8), personas, "2026-11-05", 18)).toHaveLength(0);
    });

    it("sin datos de hoy cuenta cero vasos y la notificación lleva el nombre", () => {
      const r = recordatoriosDeCuidado(
        [{ personaId: "d", metaAgua: 8, ejercicio: null, dias: [] }],
        personas,
        hoy,
        11,
      );
      expect(r[0]!.texto).toContain("0 de 8");
      expect(notificacionDeCuidado(r[0]!)).toMatchObject({
        titulo: "💧 Diego: agua",
        tag: "cuidado-d-agua",
      });
    });
  });
});
