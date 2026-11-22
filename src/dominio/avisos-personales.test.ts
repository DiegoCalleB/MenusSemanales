import { describe, expect, it } from "vitest";
import {
  CFG_POR_DEFECTO,
  HORA_PRIMERA,
  HORA_ULTIMA,
  horasPermitidas,
  limpiarCfg,
  minimoDeAgua,
} from "./avisos-personales";
import { recordatoriosDeCuidado } from "./cuidado";

describe("avisos personales (D-204)", () => {
  it("sin nada, lo de siempre; con basura, lo de siempre", () => {
    expect(limpiarCfg(undefined)).toEqual(CFG_POR_DEFECTO);
    expect(limpiarCfg("x")).toEqual(CFG_POR_DEFECTO);
    expect(limpiarCfg({ agua: { horas: "mal" }, ejercicio: { hora: 99 } })).toEqual(
      CFG_POR_DEFECTO,
    );
  });
  it("solo horas de 7 a 21 (silencio de la noche), sin repetir, ordenadas y hasta 4", () => {
    const c = limpiarCfg({ agua: { on: true, horas: [20, 3, 9, 9, 23, 12, 15, 10, 8] } });
    expect(c.agua.horas).toEqual([8, 9, 10, 12]);
    expect(limpiarCfg({ ejercicio: { on: false, hora: 22 } }).ejercicio).toEqual({
      on: false,
      hora: 18,
    });
    expect(horasPermitidas()[0]).toBe(HORA_PRIMERA);
    expect(horasPermitidas().at(-1)).toBe(HORA_ULTIMA);
  });
  it("el mínimo de agua conserva lo de siempre (11 h y 17 h) y crece con la hora", () => {
    expect(minimoDeAgua(11)).toBe(0.25);
    expect(minimoDeAgua(17)).toBe(0.6);
    expect(minimoDeAgua(14)).toBeGreaterThan(minimoDeAgua(10));
    expect(minimoDeAgua(8)).toBeGreaterThanOrEqual(0.15);
    expect(minimoDeAgua(21)).toBeLessThanOrEqual(0.9);
  });
  it("el agua y el ejercicio avisan a las horas elegidas y se apagan con su interruptor", () => {
    const hoy = "2026-11-18"; // miércoles
    const base = {
      personaId: "d",
      metaAgua: 8,
      ejercicio: { nombre: "Correr", dias: [3] },
      avisos: true,
      avisoDia: null,
      totalLista: 0,
      dias: [],
    };
    const personas = [{ id: "d", nombre: "Diego" }];
    const con = (cfg: unknown) => ({ ...base, cfg });
    const tipos = (cfg: unknown, hora: number) =>
      recordatoriosDeCuidado([con(cfg)], personas, hoy, hora).map((r) => r.tipo);
    // Lo de siempre.
    expect(tipos(undefined, 11)).toEqual(["agua"]);
    expect(tipos(undefined, 18)).toEqual(["ejercicio"]);
    expect(tipos(undefined, 15)).toEqual([]);
    // Otras horas elegidas.
    expect(
      tipos({ agua: { on: true, horas: [15] }, ejercicio: { on: true, hora: 20 } }, 15),
    ).toEqual(["agua"]);
    expect(
      tipos({ agua: { on: true, horas: [15] }, ejercicio: { on: true, hora: 20 } }, 11),
    ).toEqual([]);
    expect(tipos({ ejercicio: { on: true, hora: 20 } }, 20)).toEqual(["ejercicio"]);
    // Interruptores.
    expect(tipos({ agua: { on: false, horas: [11] } }, 11)).toEqual([]);
    expect(tipos({ ejercicio: { on: false, hora: 18 } }, 18)).toEqual([]);
  });
});
