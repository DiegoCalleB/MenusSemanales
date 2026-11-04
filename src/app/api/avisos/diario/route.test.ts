import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  enviar: vi.fn(),
  leer: vi.fn(),
  push: vi.fn(),
  subs: vi.fn(),
  olvidar: vi.fn(),
  pushActivo: { v: false },
}));
vi.mock("@/infraestructura/avisos/resend", () => ({
  CorreoNoConfigurado: class CorreoNoConfigurado extends Error {},
  enviarCorreo: m.enviar,
}));
vi.mock("@/infraestructura/avisos/push", () => ({
  enviarPush: m.push,
  pushConfigurado: () => m.pushActivo.v,
}));
vi.mock("@/infraestructura/avisos/suscripciones", () => ({
  leerSuscripciones: m.subs,
  olvidarSuscripcion: m.olvidar,
}));
vi.mock("@/infraestructura/calendario-suscrito", () => ({
  hoyEnMadrid: () => "2026-11-03",
  leerResumenDelCalendario: m.leer,
}));

import { POST } from "./route";

const TOKEN = "a".repeat(64);
const SECRETO = "secreto-de-prueba-largo-1234567890";
const pedir = (cabecera?: string, consulta = "") =>
  POST(
    new Request(`http://localhost/api/avisos/diario${consulta}`, {
      method: "POST",
      headers: cabecera ? { authorization: cabecera } : {},
    }),
  );
const resumen = {
  personas: [],
  cenas: [{ fecha: "2026-11-03", nombre: "Pollo empanado" }],
  almuerzos: [],
  eventos: {},
  agenda: [],
  casa: [],
  cumples: [],
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AVISOS_CRON_SECRET", SECRETO);
  vi.stubEnv("AVISOS_CALENDARIO_TOKEN", TOKEN);
  vi.stubEnv("AVISOS_CORREO", "diego@ejemplo.test");
  m.enviar.mockReset().mockResolvedValue(undefined);
  m.leer.mockReset().mockResolvedValue(resumen);
  m.pushActivo.v = false;
  m.push.mockReset().mockResolvedValue("ok");
  m.subs.mockReset().mockResolvedValue([]);
  m.olvidar.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/avisos/diario", () => {
  it("sin configurar responde 503 y no hace nada", async () => {
    vi.stubEnv("AVISOS_CRON_SECRET", "");
    expect((await pedir(`Bearer ${SECRETO}`)).status).toBe(503);
    expect(m.enviar).not.toHaveBeenCalled();
  });

  it("sin secreto o con otro, 401 y no lee nada", async () => {
    expect((await pedir()).status).toBe(401);
    expect((await pedir("Bearer otro-secreto-distinto-123456789")).status).toBe(401);
    expect(m.leer).not.toHaveBeenCalled();
  });

  it("fuera de la hora elegida no envía (el programa llama dos veces al día)", async () => {
    vi.stubEnv("AVISOS_HORA", "3");
    const r = await pedir(`Bearer ${SECRETO}`);
    expect(await r.json()).toEqual({ enviado: false, motivo: "no-es-la-hora" });
    expect(m.enviar).not.toHaveBeenCalled();
  });

  it("con forzar envía aunque no sea la hora, con el resumen del día", async () => {
    vi.stubEnv("AVISOS_HORA", "3");
    const r = await pedir(`Bearer ${SECRETO}`, "?forzar=1");
    expect(r.status).toBe(200);
    expect((await r.json()).enviado).toBe(true);
    const c = m.enviar.mock.calls[0]?.[0];
    expect(c.para).toEqual(["diego@ejemplo.test"]);
    expect(c.asunto).toContain("martes 3 de noviembre");
    expect(c.asunto).toContain("Pollo empanado");
  });

  it("a la hora elegida envía solo, con una clave por día (Resend no lo repite)", async () => {
    const ahoraEnMadrid = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date());
    vi.stubEnv("AVISOS_HORA", String(Number(ahoraEnMadrid)));
    const r = await pedir(`Bearer ${SECRETO}`);
    expect((await r.json()).enviado).toBe(true);
    expect(m.enviar.mock.calls[0]?.[0].clave).toBe("resumen-2026-11-03");
  });

  it("si Resend falla, 502 sin detalles", async () => {
    m.enviar.mockRejectedValue(new Error("secreto del proveedor"));
    const r = await pedir(`Bearer ${SECRETO}`, "?forzar=1");
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain("secreto");
  });

  it("si no hay plan guardado para ese token, 404", async () => {
    m.leer.mockResolvedValue(null);
    expect((await pedir(`Bearer ${SECRETO}`, "?forzar=1")).status).toBe(404);
  });

  describe("notificaciones push", () => {
    const sub = (n: number) => ({
      endpoint: `https://push.example.test/${n}`,
      p256dh: "p".repeat(30),
      auth: "a".repeat(12),
    });

    it("manda una notificación a cada móvil suscrito, además del correo", async () => {
      m.pushActivo.v = true;
      m.subs.mockResolvedValue([sub(1), sub(2)]);
      const r = await pedir(`Bearer ${SECRETO}`, "?forzar=1");
      const cuerpo = await r.json();
      expect(r.status).toBe(200);
      expect(cuerpo).toMatchObject({
        enviado: true,
        correo: "ok",
        push: { enviadas: 2, caducadas: 0, fallos: 0 },
      });
      expect(m.push).toHaveBeenCalledTimes(2);
      expect(m.push.mock.calls[0]?.[1]).toMatchObject({
        titulo: expect.stringContaining("Pollo empanado"),
      });
    });

    it("olvida las suscripciones que el servicio de notificaciones da por caducadas", async () => {
      m.pushActivo.v = true;
      m.subs.mockResolvedValue([sub(1), sub(2)]);
      m.push.mockResolvedValueOnce("ok").mockResolvedValueOnce("caducada");
      const cuerpo = await (await pedir(`Bearer ${SECRETO}`, "?forzar=1")).json();
      expect(cuerpo.push).toEqual({ enviadas: 1, caducadas: 1, fallos: 0 });
      expect(m.olvidar).toHaveBeenCalledWith(TOKEN, "https://push.example.test/2");
    });

    it("solo con push (sin correo) también funciona", async () => {
      vi.stubEnv("AVISOS_CORREO", "");
      m.pushActivo.v = true;
      m.subs.mockResolvedValue([sub(1)]);
      const r = await pedir(`Bearer ${SECRETO}`, "?forzar=1");
      expect(r.status).toBe(200);
      expect(m.enviar).not.toHaveBeenCalled();
      expect((await r.json()).push.enviadas).toBe(1);
    });

    it("si el correo falla pero la notificación llega, no es un error", async () => {
      m.pushActivo.v = true;
      m.subs.mockResolvedValue([sub(1)]);
      m.enviar.mockRejectedValue(new Error("x"));
      const r = await pedir(`Bearer ${SECRETO}`, "?forzar=1");
      expect(r.status).toBe(200);
      expect(await r.json()).toMatchObject({ enviado: true, correo: "fallo" });
    });

    it("con push configurado y ningún móvil suscrito, no es un error", async () => {
      vi.stubEnv("AVISOS_CORREO", "");
      m.pushActivo.v = true;
      const r = await pedir(`Bearer ${SECRETO}`, "?forzar=1");
      expect(r.status).toBe(200);
      expect((await r.json()).enviado).toBe(false);
    });
  });
});
