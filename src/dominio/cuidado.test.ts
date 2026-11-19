import { describe, expect, it } from "vitest";
import {
  type Cuidado,
  animoDeAgua,
  cuidadoDe,
  historialDeHabitos,
  notificacionDeCuidado,
  rachaDeHabito,
  resumenDelDia,
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
  avisoDia: null,
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
        habitos: Array.from({ length: 16 }, (_, i) => `cosa${i}`),
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
      avisoDia: null,
    });
    expect(
      validarAjustes({ metaAgua: 8, habitos: [], ejercicio: null, avisos: false, avisoDia: 21 }),
    ).toMatchObject({ avisoDia: 21 });
    expect(
      validarAjustes({ metaAgua: 8, habitos: [], ejercicio: null, avisos: false, avisoDia: 24 }),
    ).toBeNull();
  });

  describe("avisos del móvil (D-183)", () => {
    const personas = [{ id: "d", nombre: "Diego" }];
    // 2026-11-04 es miércoles (3).
    const hoy = "2026-11-04";
    const base = (agua: number, ejercicio = false, extra: object = {}) => [
      {
        personaId: "d",
        metaAgua: 8,
        ejercicio: { nombre: "Correr", dias: [1, 3, 5] },
        avisos: true,
        avisoDia: null,
        totalLista: 0,
        dias: [{ fecha: hoy, agua, ejercicio, lista: 0 }],
        ...extra,
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

    it("sin pedir los avisos de agua y ejercicio no manda esos, pero sí el de la lista", () => {
      const sin = base(0, false, { avisos: false });
      expect(recordatoriosDeCuidado(sin, personas, hoy, 11)).toHaveLength(0);
      expect(recordatoriosDeCuidado(sin, personas, hoy, 18)).toHaveLength(0);
    });

    it("recuerda «Mi día» a su hora si queda algo, sin decir qué (D-187)", () => {
      const lista = (hechas: number) =>
        base(8, true, {
          avisos: false,
          avisoDia: 21,
          totalLista: 4,
          dias: [{ fecha: hoy, agua: 8, ejercicio: true, lista: hechas }],
        });
      const r = recordatoriosDeCuidado(lista(1), personas, hoy, 21);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ tipo: "lista" });
      expect(r[0]!.texto).toContain("faltan 3 cosas");
      expect(notificacionDeCuidado(r[0]!).titulo).toBe("✅ Diego: tu lista del día");
      // Todo hecho, otra hora, o sin lista: nada.
      expect(recordatoriosDeCuidado(lista(4), personas, hoy, 21)).toHaveLength(0);
      expect(recordatoriosDeCuidado(lista(1), personas, hoy, 20)).toHaveLength(0);
      expect(
        recordatoriosDeCuidado(base(0, false, { avisoDia: 21, totalLista: 0 }), personas, hoy, 21),
      ).toHaveLength(0);
    });

    it("sin datos de hoy cuenta cero vasos y la notificación lleva el nombre", () => {
      const r = recordatoriosDeCuidado(
        [
          {
            personaId: "d",
            metaAgua: 8,
            ejercicio: null,
            avisos: true,
            avisoDia: null,
            totalLista: 0,
            dias: [],
          },
        ],
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

describe("Mi día: lista diaria e historial (D-186)", () => {
  const leer = { id: "h1", nombre: "Leer", desde: "2026-11-10" };
  const antigua = { id: "h2", nombre: "Escaleras" };
  const c = {
    ...base(
      {
        "2026-11-16": { agua: 0, habitos: ["h1", "h2"], ejercicio: false },
        "2026-11-17": { agua: 0, habitos: ["h1"], ejercicio: false },
        "2026-11-18": { agua: 0, habitos: ["h1"], ejercicio: false },
      },
      null,
    ),
    habitos: [leer, antigua],
  };

  it("cuenta lo hecho de cada día sobre lo que había apuntado", () => {
    expect(resumenDelDia(c, "2026-11-16")).toEqual({ hechos: 2, total: 2 });
    expect(resumenDelDia(c, "2026-11-18")).toEqual({ hechos: 1, total: 2 });
    // Antes de apuntar «Leer» (10-nov) solo cuenta la antigua.
    expect(resumenDelDia(c, "2026-11-09")).toEqual({ hechos: 0, total: 1 });
  });

  it("la racha cuenta hasta hoy, o hasta ayer si hoy aún falta", () => {
    expect(rachaDeHabito(c, "h1", HOY)).toBe(3);
    expect(rachaDeHabito(c, "h1", "2026-11-19")).toBe(3);
    expect(rachaDeHabito(c, "h2", HOY)).toBe(0);
    expect(rachaDeHabito(c, "h2", "2026-11-17")).toBe(1);
  });

  it("el historial marca hecho, no, hoy pendiente y aún no apuntado", () => {
    const h = historialDeHabitos(c, HOY, 14);
    expect(h.fechas).toHaveLength(14);
    expect(h.fechas.at(-1)).toBe(HOY);
    const leerFila = h.filas[0]!;
    expect(leerFila.celdas.at(-1)).toBe("hecho");
    expect(leerFila.celdas[0]).toBe("antes");
    expect(leerFila.hechos).toBe(3);
    expect(leerFila.racha).toBe(3);
    const esc = h.filas[1]!;
    expect(esc.celdas.at(-1)).toBe("pendiente");
    expect(esc.celdas.at(-2)).toBe("no");
    expect(esc.hechos).toBe(1);
    expect(esc.aplicables).toBe(13);
    // Hoy sin hacer no cuenta como fallo en los días aplicables.
    const sinHoy = historialDeHabitos({ ...c, dias: {} }, HOY, 3);
    expect(sinHoy.filas[0]!.celdas.at(-1)).toBe("pendiente");
    expect(sinHoy.filas[0]!.aplicables).toBe(2);
  });
});
