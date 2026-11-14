import { describe, expect, it } from "vitest";
import {
  type Pronostico,
  consejosDelTiempo,
  lluviaEnFranja,
  pronosticosDe,
  resumenDelTiempo,
  textoDeLluvia,
  textoDeLluviaDelCole,
} from "./tiempo";

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

/**
 * La lluvia hora a hora junto al cole (D-148). Las horas son las reales de Open-Meteo del
 * 14-11-2026 en Las Musas: chubascos al amanecer con solo un 25-33 % de probabilidad.
 */
const HORAS_REALES = {
  time: Array.from({ length: 24 }, (_, h) => `2026-11-14T${String(h).padStart(2, "0")}:00`),
  precipitation_probability: [
    10, 5, 8, 5, 3, 3, 23, 25, 33, 30, 25, 63, 83, 83, 60, 45, 28, 5, 0, 3, 0, 0, 0, 0,
  ],
  precipitation: [
    0, 0, 0, 0, 0, 0, 1.1, 1.2, 0.6, 0, 0, 0.2, 0.3, 0.1, 0.6, 0.3, 0.2, 0, 0, 0, 0, 0, 0, 0,
  ],
  weather_code: [3, 3, 3, 3, 3, 3, 95, 80, 80, 3, 3, 3, 80, 3, 80, 80, 2, 3, 3, 3, 2, 2, 3, 2],
};

describe("la lluvia a la hora del cole (D-148)", () => {
  const conHoras = pronosticosDe({ ...REAL, hourly: HORAS_REALES });
  const sab = conHoras[0]!;

  it("lee las horas de cada día; sin horas, el día queda como antes", () => {
    expect(sab.horas).toHaveLength(24);
    expect(sab.horas?.[8]).toEqual({ hora: 8, prob: 33, mm: 0.6, codigo: 80 });
    expect(conHoras[1]!.horas).toBeUndefined();
    expect(pronosticosDe(REAL)[0]!.horas).toBeUndefined();
    // Unas horas rotas no tiran el día: se descartan solo ellas.
    expect(pronosticosDe({ ...REAL, hourly: { time: "x" } })).toHaveLength(3);
  });

  it("un chubasco con poca probabilidad también cuenta: ida de 7 a 9 y vuelta de 13 a 16", () => {
    const ida = lluviaEnFranja(sab, "ida");
    expect(ida).toEqual({
      franja: "ida",
      desde: 7,
      hasta: 9,
      prob: 33,
      mm: 0.6,
      sinDetalle: false,
    });
    expect(textoDeLluvia(ida!)).toBe("de camino al cole (de 7 a 9 h, 33 %)");
    expect(textoDeLluvia(lluviaEnFranja(sab, "vuelta")!)).toBe(
      "a la salida del cole (de 13 a 16 h, 60 %)",
    );
  });

  it("si no moja en la franja, nada, aunque llueva otro rato del día", () => {
    const horas = Array.from({ length: 24 }, (_, hora) => ({
      hora,
      prob: hora >= 20 ? 90 : 5,
      mm: hora >= 20 ? 3 : 0,
      codigo: hora >= 20 ? 63 : 2,
    }));
    const p = dia({ probLluvia: 90, lluviaMm: 9, codigo: 63, horas });
    expect(lluviaEnFranja(p, "ida")).toBeNull();
    expect(lluviaEnFranja(p, "vuelta")).toBeNull();
  });

  it("por cada una de las tres señales basta: 30 %, 0,1 mm o el código de lluvia", () => {
    const una = (h: Partial<{ prob: number; mm: number; codigo: number }>) =>
      lluviaEnFranja(
        dia({
          horas: [8, 9, 10].map((hora) => ({
            hora,
            prob: 0,
            mm: 0,
            codigo: 1,
            ...(hora === 9 ? h : {}),
          })),
        }),
        "ida",
      );
    expect(una({})).toBeNull();
    expect(una({ prob: 29 })).toBeNull();
    expect(una({ prob: 30 })?.desde).toBe(8);
    expect(una({ mm: 0.1 })?.hasta).toBe(9);
    expect(una({ codigo: 51 })).not.toBeNull();
  });

  it("si faltan horas de la franja, ante la duda se mira el día entero", () => {
    const sinHoras = dia({ probLluvia: 60, lluviaMm: 2 });
    expect(lluviaEnFranja(sinHoras, "ida")).toMatchObject({ sinDetalle: true, prob: 60 });
    expect(
      textoDeLluviaDelCole([lluviaEnFranja(sinHoras, "ida")!, lluviaEnFranja(sinHoras, "vuelta")!]),
    ).toBe("puede llover a la hora del cole (60 % en el día)");
    expect(
      lluviaEnFranja(dia({ horas: [{ hora: 8, prob: 0, mm: 0, codigo: 1 }] }), "ida"),
    ).toBeNull();
  });
});
