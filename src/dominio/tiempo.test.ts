import { describe, expect, it } from "vitest";
import { type Pronostico, consejosDelTiempo, pronosticosDe, resumenDelTiempo } from "./tiempo";

/** El tiempo (D-145). La respuesta de ejemplo es una real de Open-Meteo (14-11-2026, Madrid). */
const REAL = {
  latitude: 40.417583,
  longitude: -3.739399,
  timezone: "Europe/Madrid",
  daily_units: { time: "iso8601" },
  daily: {
    time: ["2026-11-14", "2026-11-15", "2026-11-16"],
    weather_code: [80, 61, 3],
    temperature_2m_max: [14.1, 12.2, 15.9],
    temperature_2m_min: [10.7, 10.6, 10.7],
    precipitation_probability_max: [65, 25, 6],
    precipitation_sum: [1.2, 1.0, 0.0],
  },
};
const dia = (p: Partial<Pronostico>): Pronostico => ({
  fecha: "2026-11-16",
  codigo: 1,
  max: 18,
  min: 9,
  probLluvia: 0,
  lluviaMm: 0,
  ...p,
});
const claves = (p: Pronostico) => consejosDelTiempo(p).map((c) => c.clave);

describe("el tiempo (D-145)", () => {
  it("lee la respuesta real de Open-Meteo", () => {
    expect(pronosticosDe(REAL)).toEqual([
      { fecha: "2026-11-14", codigo: 80, max: 14.1, min: 10.7, probLluvia: 65, lluviaMm: 1.2 },
      { fecha: "2026-11-15", codigo: 61, max: 12.2, min: 10.6, probLluvia: 25, lluviaMm: 1 },
      { fecha: "2026-11-16", codigo: 3, max: 15.9, min: 10.7, probLluvia: 6, lluviaMm: 0 },
    ]);
  });

  it("una respuesta rota o con huecos no inventa nada", () => {
    expect(pronosticosDe(null)).toEqual([]);
    expect(pronosticosDe({ error: true, reason: "x" })).toEqual([]);
    const hueco = structuredClone(REAL);
    (hueco.daily.temperature_2m_max as Array<number | null>)[1] = null;
    expect(pronosticosDe(hueco).map((p) => p.fecha)).toEqual(["2026-11-14", "2026-11-16"]);
  });

  it("lluvia por probabilidad o por litros: ante la duda, el chubasquero", () => {
    const [sab, dom, lun] = pronosticosDe(REAL);
    expect(consejosDelTiempo(sab!)).toEqual([
      { clave: "lluvia", emoji: "🌧️", que: "Lluvia (65 %)", llevar: "chubasquero y botas" },
    ]);
    expect(claves(dom!)).toEqual(["lluvia"]); // 25 % pero 1 mm
    expect(claves(lun!)).toEqual([]);
    expect(claves(dia({ probLluvia: 49, lluviaMm: 0.9 }))).toEqual([]);
  });

  it("tormenta y nieve mandan sobre la lluvia; la nieve ya dice abrigo", () => {
    expect(claves(dia({ codigo: 95, probLluvia: 90 }))).toEqual(["tormenta"]);
    expect(claves(dia({ codigo: 73, min: -2 }))).toEqual(["nieve"]);
  });

  it("frío a 4 °C o menos y calor a 30 °C o más", () => {
    expect(consejosDelTiempo(dia({ min: 3.6 }))).toEqual([
      { clave: "frio", emoji: "🧣", que: "Frío (mín. 4 °C)", llevar: "abrigo, gorro y guantes" },
    ]);
    expect(claves(dia({ min: 4.4 }))).toEqual([]);
    expect(claves(dia({ max: 30 }))).toEqual(["calor"]);
    expect(claves(dia({ min: -1, probLluvia: 80 }))).toEqual(["lluvia", "frio"]);
  });

  it("el resumen de un vistazo", () => {
    expect(resumenDelTiempo(dia({ codigo: 0, min: 9.4, max: 18.6 }))).toBe("☀️ 9–19 °C");
    expect(resumenDelTiempo(dia({ codigo: 80 }))).toBe("🌧️ 9–18 °C");
  });
});
