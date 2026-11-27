import { describe, expect, it } from "vitest";
import {
  ahoraEnMadrid,
  cuandoSuena,
  cuerpoDeRecordatorio,
  resolverRecordatorio,
} from "./recordatorio";

const a = (fecha: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return { fecha, minutos: (h ?? 0) * 60 + (m ?? 0) };
};

describe("recordatorio: ahora en Madrid", () => {
  it("convierte de UTC (invierno, +1) y respeta el día", () => {
    expect(ahoraEnMadrid(new Date("2026-11-26T22:30:00Z"))).toEqual({
      fecha: "2026-11-26",
      minutos: 23 * 60 + 30,
    });
    expect(ahoraEnMadrid(new Date("2026-11-26T23:30:00Z"))).toEqual({
      fecha: "2026-11-27",
      minutos: 30,
    });
  });
});

describe("recordatorio: a qué hora suena", () => {
  it("«a las seis» sin decir mañana o tarde: la próxima vez que llegue", () => {
    expect(resolverRecordatorio("06:00", true, null, a("2026-11-27", "10:00"))).toEqual({
      fecha: "2026-11-27",
      hora: "18:00",
    });
    expect(resolverRecordatorio("06:00", true, null, a("2026-11-27", "20:00"))).toEqual({
      fecha: "2026-11-28",
      hora: "18:00",
    });
    // A las 5:00 de la madrugada, las 6 de la mañana todavía no han pasado.
    expect(resolverRecordatorio("06:00", true, null, a("2026-11-27", "05:00"))).toEqual({
      fecha: "2026-11-27",
      hora: "18:00",
    });
  });
  it("si la hora habitual ya pasó pero la otra mitad no, usa la otra", () => {
    expect(resolverRecordatorio("10:00", true, null, a("2026-11-27", "11:00"))).toEqual({
      fecha: "2026-11-27",
      hora: "22:00",
    });
  });
  it("con la hora clara no hay duda", () => {
    expect(resolverRecordatorio("18:00", false, null, a("2026-11-27", "10:00"))).toEqual({
      fecha: "2026-11-27",
      hora: "18:00",
    });
    expect(resolverRecordatorio("07:30", false, null, a("2026-11-27", "10:00"))).toEqual({
      fecha: "2026-11-28",
      hora: "07:30",
    });
  });
  it("con día, de 1 a 7 es de la tarde, de 8 a 11 de la mañana y las 12 al mediodía", () => {
    const ahora = a("2026-11-27", "10:00");
    expect(resolverRecordatorio("06:00", true, "2026-11-28", ahora)).toEqual({
      fecha: "2026-11-28",
      hora: "18:00",
    });
    expect(resolverRecordatorio("09:00", true, "2026-11-28", ahora)).toEqual({
      fecha: "2026-11-28",
      hora: "09:00",
    });
    expect(resolverRecordatorio("12:00", true, "2026-11-28", ahora)).toEqual({
      fecha: "2026-11-28",
      hora: "12:00",
    });
  });
  it("lo imposible, null", () => {
    const ahora = a("2026-11-27", "10:00");
    expect(resolverRecordatorio("25:00", false, null, ahora)).toBeNull();
    expect(resolverRecordatorio("09:00", false, "2026-11-20", ahora)).toBeNull();
    expect(resolverRecordatorio("09:00", false, "2026-11-27", ahora)).toBeNull(); // hoy, ya pasó
  });
});

describe("recordatorio: lo que se dice y lo que se manda a Alexa", () => {
  it("dice cuándo suena", () => {
    expect(cuandoSuena("2026-11-27", "18:00", "2026-11-27")).toBe("hoy a las 18:00");
    expect(cuandoSuena("2026-11-28", "09:30", "2026-11-27")).toBe("mañana a las 9:30");
    expect(cuandoSuena("2026-12-03", "18:00", "2026-11-27")).toBe("el 3 del 12 a las 18:00");
  });
  it("arma el cuerpo de la API de recordatorios", () => {
    const c = cuerpoDeRecordatorio(
      "sacar la basura",
      "2026-11-27",
      "18:00",
      new Date("2026-11-27T09:00:00Z"),
    );
    expect(c).toEqual({
      requestTime: "2026-11-27T09:00:00.000Z",
      trigger: {
        type: "SCHEDULED_ABSOLUTE",
        scheduledTime: "2026-11-27T18:00:00.000",
        timeZoneId: "Europe/Madrid",
      },
      alertInfo: { spokenInfo: { content: [{ locale: "es-ES", text: "sacar la basura" }] } },
      pushNotification: { status: "ENABLED" },
    });
  });
});
