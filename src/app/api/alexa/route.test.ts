import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const t = vi.hoisted(() => ({
  firmada: vi.fn(async () => true),
  anadir: vi.fn(async () => "ok" as string | null),
  entrada: vi.fn<(...a: unknown[]) => Promise<string | null>>(async () => "ok"),
  usoIa: vi.fn(async () => "ok" as string | null),
  captura: vi.fn<(...a: unknown[]) => Promise<{ items: unknown[]; pasados: number }>>(async () => ({
    items: [],
    pasados: 0,
  })),
  resumen: vi.fn(async () => null as unknown),
}));
vi.mock("@/infraestructura/alexa-firma", () => ({
  peticionDeAlexa: t.firmada,
  obtenerCertificadoDeAmazon: vi.fn(),
}));
vi.mock("@/infraestructura/alexa", () => ({
  anadirCompraDesdeAlexa: t.anadir,
  anadirEntradaAlexa: t.entrada,
  usarIaAlexa: t.usoIa,
}));
vi.mock("@/infraestructura/ia/captura", () => ({ leerCaptura: t.captura }));
vi.mock("@/infraestructura/tiempo", () => ({ leerPrevision: async () => [] }));
vi.mock("@/infraestructura/calendario-suscrito", () => ({
  demasiadasPeticiones: () => false,
  leerResumenDelCalendario: t.resumen,
}));

import { POST as PostConRuta } from "./[token]/route";
import { POST } from "./route";

const TOKEN = "a".repeat(64);
const SKILL = "amzn1.ask.skill.casa";

const pedir = (
  intent: unknown,
  opciones: { token?: string; skill?: string; tipo?: string; atributos?: unknown } = {},
) =>
  POST(
    new Request(`http://localhost/api/alexa?t=${opciones.token ?? TOKEN}`, {
      method: "POST",
      headers: {
        "signature-256": "x",
        signaturecertchainurl: "https://s3.amazonaws.com/echo.api/c.pem",
      },
      body: JSON.stringify({
        context: { System: { application: { applicationId: opciones.skill ?? SKILL } } },
        session: {
          application: { applicationId: opciones.skill ?? SKILL },
          attributes: opciones.atributos,
        },
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
    t.entrada.mockResolvedValue("ok");
    t.usoIa.mockResolvedValue("ok");
    t.captura.mockResolvedValue({ items: [], pasados: 0 });
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

  describe("Conchi (D-215)", () => {
    const resumen = {
      personas: [{ id: "diego", nombre: "Diego", tipo: "adulto", activa: true }],
      cenas: [],
      almuerzos: [],
      eventos: {},
      agenda: [{ fecha: "2026-11-05", hasta: null, hora: null, titulo: "Pediatra" }],
      casa: [
        {
          titulo: "Poner la lavadora",
          emoji: "🏠",
          cadaDias: 14,
          responsableId: null,
          ultimaVez: null,
          desde: "2026-10-01",
          aplazadaHasta: null,
        },
      ],
      cumples: [],
    };
    const item = (extra: object) => ({
      tipo: "compra",
      titulo: "pañales",
      fecha: "",
      hasta: "",
      hora: "",
      persona: null,
      importante: false,
      repiteMeses: null,
      categoria: "otro",
      ...extra,
    });
    const frase = (valor: string) => ({ name: "ConchiIntent", slots: { frase: { value: valor } } });
    const completa = async (r: Response) =>
      (await r.json()) as {
        sessionAttributes?: { porConfirmar?: unknown[] };
        response: { outputSpeech?: { text: string }; shouldEndSession?: boolean };
      };

    beforeEach(() => {
      vi.useFakeTimers({ now: new Date("2026-11-04T12:00:00Z"), toFake: ["Date"] });
      t.resumen.mockResolvedValue(resumen);
    });
    afterEach(() => vi.useRealTimers());

    it("una frase libre: guarda lo directo y pregunta por la cita", async () => {
      t.captura.mockResolvedValue({
        items: [
          item({ tipo: "compra", titulo: "pañales" }),
          item({ tipo: "evento", titulo: "Psicotécnico", fecha: "2026-11-05", hora: "18:00" }),
        ],
        pasados: 0,
      });
      const r = await completa(
        await pedir(frase("compra pañales y el jueves a las seis psicotécnico")),
      );
      expect(t.entrada).toHaveBeenCalledWith(TOKEN, {
        tipo: "compra",
        texto: "pañales",
        fecha: null,
        hora: null,
      });
      expect(r.response.outputSpeech?.text).toBe(
        "Apuntado: pañales en la compra. ¿Apunto Psicotécnico mañana a las 18:00? Di sí o no.",
      );
      expect(r.response.shouldEndSession).toBe(false);
      expect(r.sessionAttributes?.porConfirmar).toHaveLength(1);
      // La cita no se guarda hasta decir que sí.
      expect(t.entrada).toHaveBeenCalledTimes(1);
    });

    it("«sí» guarda la cita; «no» la descarta", async () => {
      const cita = { tipo: "cita", texto: "Psicotécnico", fecha: "2026-11-05", hora: "18:00" };
      const si = await completa(
        await pedir({ name: "AMAZON.YesIntent" }, { atributos: { porConfirmar: [cita] } }),
      );
      expect(si.response.outputSpeech?.text).toBe("Apuntado.");
      expect(t.entrada).toHaveBeenCalledWith(TOKEN, cita);
      t.entrada.mockClear();
      const no = await completa(
        await pedir(
          { name: "AMAZON.NoIntent" },
          { atributos: { porConfirmar: [cita, { ...cita, texto: "Otra" }] } },
        ),
      );
      expect(t.entrada).not.toHaveBeenCalled();
      expect(no.response.outputSpeech?.text).toContain("Vale, no lo apunto. ¿Apunto Otra");
      expect(no.sessionAttributes?.porConfirmar).toHaveLength(1);
      const nada = await completa(await pedir({ name: "AMAZON.YesIntent" }));
      expect(nada.response.outputSpeech?.text).toContain("nada pendiente");
    });

    it("si la IA no entiende, o se gasta el cupo, lo dice", async () => {
      expect((await completa(await pedir(frase("blablá")))).response.outputSpeech?.text).toContain(
        "No he entendido",
      );
      t.usoIa.mockResolvedValue("tope");
      expect(
        (await completa(await pedir(frase("compra pan")))).response.outputSpeech?.text,
      ).toContain("cupo");
      expect(t.captura).toHaveBeenCalledTimes(1);
      t.usoIa.mockResolvedValue(null);
      expect(
        (await completa(await pedir(frase("compra pan")))).response.outputSpeech?.text,
      ).toContain("No encuentro vuestra casa");
      t.usoIa.mockResolvedValue("ok");
      t.captura.mockRejectedValue(new Error("ia-tiempo"));
      expect(
        (await completa(await pedir(frase("compra pan")))).response.outputSpeech?.text,
      ).toContain("No he podido entenderlo");
      t.captura.mockResolvedValue({ items: [], pasados: 0 });
      expect(
        (await completa(await pedir({ name: "ConchiIntent" }))).response.shouldEndSession,
      ).toBe(false);
    });

    it("«ya he hecho la lavadora» marca la tarea; si no la encuentra, pregunta", async () => {
      const ok = await completa(
        await pedir({ name: "HechoIntent", slots: { tarea: { value: "la lavadora" } } }),
      );
      expect(ok.response.outputSpeech?.text).toBe("Marcado como hecho: Poner la lavadora.");
      expect(t.entrada).toHaveBeenCalledWith(TOKEN, {
        tipo: "hecha",
        texto: "Poner la lavadora",
        fecha: null,
        hora: null,
      });
      t.entrada.mockClear();
      const no = await completa(
        await pedir({ name: "HechoIntent", slots: { tarea: { value: "la colada" } } }),
      );
      expect(no.response.outputSpeech?.text).toContain("No sé qué tarea");
      expect(t.entrada).not.toHaveBeenCalled();
    });

    it("lee mañana, la casa, el tiempo y el resumen", async () => {
      expect(
        (await completa(await pedir({ name: "MananaIntent" }))).response.outputSpeech?.text,
      ).toBe("Mañana tienes Pediatra.");
      expect(
        (await completa(await pedir({ name: "CasaIntent" }))).response.outputSpeech?.text,
      ).toBe("Hoy toca en casa: Poner la lavadora.");
      expect(
        (await completa(await pedir({ name: "MochilaIntent" }))).response.outputSpeech?.text,
      ).toContain("No hay nada que preparar");
      expect(
        (await completa(await pedir({ name: "TiempoIntent" }))).response.outputSpeech?.text,
      ).toContain("tiempo");
      expect(
        (await completa(await pedir({ name: "AvisosIntent" }))).response.outputSpeech?.text,
      ).toContain("Poner la lavadora");
    });
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
