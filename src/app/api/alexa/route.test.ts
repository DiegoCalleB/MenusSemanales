import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const t = vi.hoisted(() => ({
  firmada: vi.fn(async () => true),
  anadir: vi.fn(async () => "ok" as string | null),
  resumen: vi.fn(async () => null as unknown),
}));
vi.mock("@/infraestructura/alexa-firma", () => ({
  peticionDeAlexa: t.firmada,
  obtenerCertificadoDeAmazon: vi.fn(),
}));
vi.mock("@/infraestructura/alexa", () => ({ anadirCompraDesdeAlexa: t.anadir }));
vi.mock("@/infraestructura/calendario-suscrito", () => ({
  demasiadasPeticiones: () => false,
  leerResumenDelCalendario: t.resumen,
}));

import { POST as PostConRuta } from "./[token]/route";
import { POST } from "./route";

const TOKEN = "a".repeat(64);
const SKILL = "amzn1.ask.skill.casa";

const pedir = (intent: unknown, opciones: { token?: string; skill?: string; tipo?: string } = {}) =>
  POST(
    new Request(`http://localhost/api/alexa?t=${opciones.token ?? TOKEN}`, {
      method: "POST",
      headers: {
        "signature-256": "x",
        signaturecertchainurl: "https://s3.amazonaws.com/echo.api/c.pem",
      },
      body: JSON.stringify({
        context: { System: { application: { applicationId: opciones.skill ?? SKILL } } },
        request: {
          type: opciones.tipo ?? "IntentRequest",
          timestamp: new Date().toISOString(),
          intent,
        },
      }),
    }),
  );
const habla = async (r: Response) =>
  ((await r.json()) as { response: { outputSpeech?: { text: string } } }).response.outputSpeech
    ?.text;

describe("POST /api/alexa", () => {
  beforeEach(() => {
    vi.stubEnv("ALEXA_SKILL_ID", SKILL);
    t.firmada.mockResolvedValue(true);
    t.anadir.mockResolvedValue("ok");
    t.resumen.mockResolvedValue(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("apagada si no hay identificador de skill", async () => {
    vi.stubEnv("ALEXA_SKILL_ID", "");
    expect((await pedir({ name: "CenaIntent" })).status).toBe(503);
  });

  it("sin token válido, 404; sin firma de Amazon o de otra skill, 400", async () => {
    expect((await pedir({ name: "CenaIntent" }, { token: "corto" })).status).toBe(404);
    t.firmada.mockResolvedValue(false);
    expect((await pedir({ name: "CenaIntent" })).status).toBe(400);
    t.firmada.mockResolvedValue(true);
    expect((await pedir({ name: "CenaIntent" }, { skill: "amzn1.ask.skill.otra" })).status).toBe(
      400,
    );
    expect(t.anadir).not.toHaveBeenCalled();
  });

  it("también con el token en la ruta", async () => {
    const r = await PostConRuta(
      new Request(`http://localhost/api/alexa/${TOKEN}`, {
        method: "POST",
        headers: {
          "signature-256": "x",
          signaturecertchainurl: "https://s3.amazonaws.com/echo.api/c.pem",
        },
        body: JSON.stringify({
          context: { System: { application: { applicationId: SKILL } } },
          request: { type: "LaunchRequest", timestamp: new Date().toISOString() },
        }),
      }),
      { params: Promise.resolve({ token: TOKEN }) },
    );
    expect(await habla(r)).toContain("¿Qué apunto");
  });

  it("añade a la compra uno o varios productos", async () => {
    const r = await pedir({
      name: "AnadirCompraIntent",
      slots: { producto: { value: "Leche y pan" } },
    });
    expect(await habla(r)).toBe("Apuntado en la compra: leche y pan.");
    expect(t.anadir).toHaveBeenCalledTimes(2);
    expect(t.anadir).toHaveBeenCalledWith(TOKEN, "leche");
    expect(t.anadir).toHaveBeenCalledWith(TOKEN, "pan");
  });

  it("sin producto pregunta; con tope lo dice; con token desconocido avisa", async () => {
    expect(await habla(await pedir({ name: "AnadirCompraIntent" }))).toContain("¿Qué quieres");
    t.anadir.mockResolvedValue("demasiadas");
    expect(
      await habla(
        await pedir({ name: "AnadirCompraIntent", slots: { producto: { value: "sal" } } }),
      ),
    ).toContain("muchas cosas");
    t.anadir.mockResolvedValue(null);
    expect(
      await habla(
        await pedir({ name: "AnadirCompraIntent", slots: { producto: { value: "sal" } } }),
      ),
    ).toContain("No encuentro vuestra casa");
  });

  it("la cena y lo de hoy salen del resumen del hogar", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-04T12:00:00Z"), toFake: ["Date"] });
    t.resumen.mockResolvedValue({
      personas: [],
      cenas: [{ fecha: "2026-11-04", nombre: "Pisto" }],
      almuerzos: [],
      eventos: {},
      agenda: [{ fecha: "2026-11-04", hasta: null, hora: "18:15", titulo: "Psicotécnico" }],
      casa: [],
    });
    expect(await habla(await pedir({ name: "CenaIntent" }))).toBe("Hoy de cena: Pisto.");
    expect(await habla(await pedir({ name: "HoyIntent" }))).toBe(
      "Hoy tienes Psicotécnico a las 18:15.",
    );
    t.resumen.mockResolvedValue(null);
    expect(await habla(await pedir({ name: "CenaIntent" }))).toContain("No encuentro vuestra casa");
    vi.useRealTimers();
  });

  it("ayuda, parar, abrir y errores", async () => {
    expect(await habla(await pedir({ name: "AMAZON.HelpIntent" }))).toContain("añade leche");
    expect(await habla(await pedir({ name: "AMAZON.StopIntent" }))).toBe("Vale.");
    expect(await habla(await pedir(undefined, { tipo: "LaunchRequest" }))).toContain("¿Qué apunto");
    const fin = await pedir(undefined, { tipo: "SessionEndedRequest" });
    expect(fin.status).toBe(200);
    t.resumen.mockRejectedValue(new Error("caído"));
    expect(await habla(await pedir({ name: "HoyIntent" }))).toContain("Ahora mismo no consigo");
  });
});
