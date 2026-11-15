import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  leer: vi.fn(),
  adjuntos: vi.fn(),
  bajar: vi.fn(),
  guardar: vi.fn(),
  ia: vi.fn(),
}));
vi.mock("@/infraestructura/correo-circulares", () => ({
  CorreoNoConfigurado: class CorreoNoConfigurado extends Error {},
  leerCorreoRecibido: m.leer,
  adjuntosDelCorreo: m.adjuntos,
  bajarAdjunto: m.bajar,
  guardarCircularCorreo: m.guardar,
}));
vi.mock("@/infraestructura/ia/circular", () => ({ leerCircular: m.ia }));
vi.mock("@/infraestructura/calendario-suscrito", () => ({ hoyEnMadrid: () => "2026-11-16" }));

import { POST } from "./route";

const CODIGO = "ab12cd34ef56gh78";
const pedir = (cuerpo: unknown) =>
  POST(
    new Request("http://localhost/api/circulares/correo", {
      method: "POST",
      body: JSON.stringify(cuerpo),
    }),
  );
const aviso = { type: "email.received", data: { email_id: "em_123" } };
const item = { tipo: "cita", titulo: "Excursión", fecha: "2026-12-01", hasta: null, hora: null };

beforeEach(() => {
  m.leer.mockReset().mockResolvedValue({
    to: [`hecho-${CODIGO}@abc.resend.app`],
    subject: "RV: Excursión al zoo",
    text: "El 1 de diciembre vamos al zoo",
    html: null,
  });
  m.adjuntos.mockReset().mockResolvedValue([]);
  m.bajar.mockReset().mockResolvedValue("JVBERi0=");
  m.guardar.mockReset().mockResolvedValue("guardada");
  m.ia.mockReset().mockResolvedValue({ items: [item], pasados: 0 });
});

describe("POST /api/circulares/correo (D-147)", () => {
  it("lee el texto del correo y lo guarda para el hogar de la dirección, sin «RV:»", async () => {
    const r = await pedir(aviso);
    expect(await r.json()).toEqual({ resultado: "guardada", cosas: 1 });
    expect(m.leer).toHaveBeenCalledWith("em_123");
    expect(m.ia).toHaveBeenCalledWith({
      hoy: "2026-11-16",
      texto: "El 1 de diciembre vamos al zoo",
    });
    expect(m.guardar).toHaveBeenCalledWith(CODIGO, "em_123", "Excursión al zoo", [item]);
  });

  it("si trae un PDF, lee el PDF", async () => {
    m.adjuntos.mockResolvedValue([
      { content_type: "application/pdf", size: 100, download_url: "https://descargas/x" },
    ]);
    await pedir(aviso);
    expect(m.bajar).toHaveBeenCalledWith("https://descargas/x", "application/pdf");
    expect(m.ia).toHaveBeenCalledWith({
      hoy: "2026-11-16",
      archivo: { mime: "application/pdf", base64: "JVBERi0=" },
    });
  });

  it("lo que no va a la dirección de un hogar, u otros avisos, se ignoran sin leer nada", async () => {
    m.leer.mockResolvedValue({ to: ["otra@bandmanager.io"], subject: "x", text: "x" });
    expect(await (await pedir(aviso)).json()).toEqual({ ignorado: "otra-direccion" });
    expect(await (await pedir({ type: "email.sent", data: {} })).json()).toEqual({
      ignorado: "tipo",
    });
    expect(m.ia).not.toHaveBeenCalled();
    expect(m.guardar).not.toHaveBeenCalled();
  });

  it("un identificador raro, 400; si Resend o la base de datos fallan, 502 (Resend reintenta)", async () => {
    expect((await pedir({ type: "email.received", data: { email_id: "../x" } })).status).toBe(400);
    m.guardar.mockImplementation(() => Promise.reject(new Error("caída")));
    expect((await pedir(aviso)).status).toBe(502);
  });
});
