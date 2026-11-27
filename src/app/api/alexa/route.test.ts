import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Asinc<T> = (...a: unknown[]) => Promise<T>;
const t = vi.hoisted(() => ({
  firmada: vi.fn(async () => true),
  compra: vi.fn(async () => "ok" as string | null),
  entrada: vi.fn<Asinc<string | null>>(async () => "ok"),
  usoIa: vi.fn(async () => "ok" as string | null),
  avisar: vi.fn<Asinc<boolean>>(async () => true),
  deshacer: vi.fn<Asinc<{ tipo: string; texto: string } | null>>(async () => null),
  leerCompra: vi.fn<Asinc<string[] | null>>(async () => []),
  persona: vi.fn<Asinc<string | null>>(async () => null),
  vincular: vi.fn<Asinc<string | null>>(async () => "ok"),
  recordatorio: vi.fn<Asinc<string>>(async () => "ok"),
  frase: vi.fn<Asinc<unknown[]>>(async () => []),
  pregunta: vi.fn<Asinc<string | null>>(async () => null),
  estadio: vi.fn<Asinc<unknown[]>>(async () => []),
  resumen: vi.fn(async () => null as unknown),
}));
vi.mock("@/infraestructura/alexa-firma", () => ({
  peticionDeAlexa: t.firmada,
  obtenerCertificadoDeAmazon: vi.fn(),
}));
vi.mock("@/infraestructura/alexa", () => ({
  anadirCompraDesdeAlexa: t.compra,
  anadirEntradaAlexa: t.entrada,
  usarIaAlexa: t.usoIa,
  avisarALaFamilia: t.avisar,
  deshacerLoUltimoDeAlexa: t.deshacer,
  leerCompraDeAlexa: t.leerCompra,
  personaDeLaVoz: t.persona,
  vincularVozDeAlexa: t.vincular,
}));
vi.mock("@/infraestructura/alexa-recordatorios", () => ({ ponerRecordatorio: t.recordatorio }));
vi.mock("@/infraestructura/ia/conchi", () => ({
  leerFrase: t.frase,
  contestarPregunta: t.pregunta,
}));
vi.mock("@/infraestructura/metropolitano", () => ({ leerEventosEstadio: t.estadio }));
vi.mock("@/infraestructura/tiempo", () => ({ leerPrevision: async () => [] }));
vi.mock("@/infraestructura/calendario-suscrito", () => ({
  demasiadasPeticiones: () => false,
  leerResumenDelCalendario: t.resumen,
}));

import { POST as PostConRuta } from "./[token]/route";
import { POST } from "./route";

const TOKEN = "a".repeat(64);
const SKILL = "amzn1.ask.skill.casa";
const VOZ = "amzn1.ask.person.AAAAAAAAAAAA";

interface Opciones {
  token?: string;
  skill?: string;
  tipo?: string;
  atributos?: unknown;
  sistema?: Record<string, unknown>;
}
const peticion = (intent: unknown, o: Opciones = {}) =>
  new Request(`http://localhost/api/alexa?t=${o.token ?? TOKEN}`, {
    method: "POST",
    headers: {
      "signature-256": "x",
      signaturecertchainurl: "https://s3.amazonaws.com/echo.api/c.pem",
    },
    body: JSON.stringify({
      context: {
        System: { application: { applicationId: o.skill ?? SKILL }, ...o.sistema },
      },
      session: {
        application: { applicationId: o.skill ?? SKILL },
        attributes: o.atributos,
      },
      request: {
        type: o.tipo ?? "IntentRequest",
        timestamp: new Date().toISOString(),
        intent,
      },
    }),
  });
const pedir = (intent: unknown, o: Opciones = {}) => POST(peticion(intent, o));

interface Completa {
  sessionAttributes?: { porConfirmar?: unknown[] };
  response: {
    outputSpeech?: { text: string };
    shouldEndSession?: boolean;
    card?: { type: string; permissions: string[] };
  };
}
const completa = async (r: Response) => (await r.json()) as Completa;
const habla = async (r: Response) => (await completa(r)).response.outputSpeech?.text;
const di = async (intent: unknown, o: Opciones = {}) => habla(await pedir(intent, o));
const slot = (nombre: string, valor: string) => ({ [nombre]: { value: valor } });

const tarea = (titulo: string, extra = {}) => ({
  titulo,
  emoji: "🏠",
  cadaDias: 14,
  responsableId: null,
  ultimaVez: null,
  desde: "2026-10-01",
  aplazadaHasta: null,
  ...extra,
});
const RESUMEN = {
  personas: [
    { id: "diego", nombre: "Diego", tipo: "adulto", activa: true },
    { id: "alba", nombre: "Alba", tipo: "nino", activa: true },
  ],
  cenas: [{ fecha: "2026-11-27", nombre: "Pisto" }],
  almuerzos: [],
  eventos: {},
  agenda: [{ fecha: "2026-11-28", hasta: null, hora: null, titulo: "Pediatra" }],
  casa: [tarea("Poner la lavadora", { responsableId: "diego" }), tarea("Sacar la basura")],
  cumples: [],
  pendientes: [
    {
      texto: "Llamar al fontanero",
      personaId: null,
      importante: false,
      creadoEn: "2026-11-20",
      hechoEn: null,
    },
  ],
  vencimientos: [
    {
      titulo: "ITV",
      categoria: "coche",
      personaId: null,
      fecha: "2026-12-04",
      avisos: [],
      hechoEn: null,
    },
  ],
};
const item = (extra: object) => ({
  tipo: "compra",
  titulo: "pañales",
  fecha: null,
  hora: null,
  ambigua: false,
  ...extra,
});

describe("POST /api/alexa", () => {
  beforeEach(() => {
    vi.stubEnv("ALEXA_SKILL_ID", SKILL);
    // Viernes 27 de noviembre de 2026, 11:00 en Madrid.
    vi.useFakeTimers({ now: new Date("2026-11-27T10:00:00Z"), toFake: ["Date"] });
    t.resumen.mockResolvedValue(RESUMEN);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    t.firmada.mockResolvedValue(true);
    t.compra.mockResolvedValue("ok");
    t.entrada.mockResolvedValue("ok");
    t.usoIa.mockResolvedValue("ok");
    t.avisar.mockResolvedValue(true);
    t.deshacer.mockResolvedValue(null);
    t.leerCompra.mockResolvedValue([]);
    t.persona.mockResolvedValue(null);
    t.vincular.mockResolvedValue("ok");
    t.recordatorio.mockResolvedValue("ok");
    t.frase.mockResolvedValue([]);
    t.pregunta.mockResolvedValue(null);
    t.estadio.mockResolvedValue([]);
  });

  describe("seguridad", () => {
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
      expect(t.compra).not.toHaveBeenCalled();
    });
    it("también con el token en la ruta", async () => {
      const r = await PostConRuta(peticion(undefined, { tipo: "LaunchRequest" }), {
        params: Promise.resolve({ token: TOKEN }),
      });
      expect(await habla(r)).toContain("Soy Conchi");
    });
  });

  describe("la compra", () => {
    it("añade uno o varios productos y avisa a la familia", async () => {
      const r = await di({ name: "AnadirCompraIntent", slots: slot("producto", "Leche y pan") });
      expect(r).toMatch(/^(Apuntado|Anotado|Listo|Hecho) en la compra: leche y pan\.$/);
      expect(t.compra).toHaveBeenCalledWith(TOKEN, "leche");
      expect(t.compra).toHaveBeenCalledWith(TOKEN, "pan");
      expect(t.avisar).toHaveBeenCalledWith(TOKEN, "leche, pan en la compra");
    });
    it("sin producto pregunta; con tope lo dice; con token desconocido avisa", async () => {
      expect(await di({ name: "AnadirCompraIntent" })).toContain("¿Qué quieres");
      t.compra.mockResolvedValue("demasiadas");
      expect(await di({ name: "AnadirCompraIntent", slots: slot("producto", "sal") })).toContain(
        "muchas cosas",
      );
      t.compra.mockResolvedValue(null);
      expect(await di({ name: "AnadirCompraIntent", slots: slot("producto", "sal") })).toContain(
        "No encuentro vuestra casa",
      );
    });
    it("lee la compra, busca en ella y quita cosas", async () => {
      t.leerCompra.mockResolvedValue(["Leche", "Pan de molde"]);
      expect(await di({ name: "CompraIntent" })).toBe(
        "En la compra hay 2 cosas: Leche y Pan de molde.",
      );
      expect(await di({ name: "HayEnCompraIntent", slots: slot("producto", "el pan") })).toBe(
        "Sí, Pan de molde está en la compra.",
      );
      expect(await di({ name: "HayEnCompraIntent", slots: slot("producto", "arroz") })).toContain(
        "No, eso no",
      );
      expect(await di({ name: "QuitarCompraIntent", slots: slot("producto", "la leche") })).toBe(
        "Quitado de la compra: Leche.",
      );
      expect(t.entrada).toHaveBeenCalledWith(TOKEN, {
        tipo: "quitar_compra",
        texto: "Leche",
        fecha: null,
        hora: null,
      });
      t.entrada.mockClear();
      expect(await di({ name: "QuitarCompraIntent", slots: slot("producto", "arroz") })).toContain(
        "No encuentro eso",
      );
      expect(t.entrada).not.toHaveBeenCalled();
      t.leerCompra.mockResolvedValue(null);
      expect(await di({ name: "CompraIntent" })).toContain("No encuentro vuestra casa");
    });
    it("«borra lo último»", async () => {
      t.deshacer.mockResolvedValue({ tipo: "compra", texto: "leche" });
      expect(await di({ name: "DeshacerIntent" })).toBe("Quitado de la compra: leche.");
      t.deshacer.mockResolvedValue(null);
      expect(await di({ name: "DeshacerIntent" })).toBe("No hay nada que deshacer.");
    });
  });

  describe("una frase libre", () => {
    const frase = (valor: string) => ({ name: "ConchiIntent", slots: slot("frase", valor) });

    it("guarda lo directo, avisa y pregunta por la cita; «sí» la guarda", async () => {
      t.frase.mockResolvedValue([
        item({ tipo: "compra", titulo: "pañales" }),
        item({ tipo: "cita", titulo: "Psicotécnico", fecha: "2026-11-28", hora: "18:00" }),
      ]);
      const r = await completa(
        await pedir(frase("compra pañales y mañana a las seis psicotécnico")),
      );
      expect(t.entrada).toHaveBeenCalledWith(TOKEN, {
        tipo: "compra",
        texto: "pañales",
        fecha: null,
        hora: null,
      });
      expect(t.avisar).toHaveBeenCalledWith(TOKEN, "pañales");
      expect(r.response.outputSpeech?.text).toMatch(
        /en la compra: pañales\.|pañales en la compra\./,
      );
      expect(r.response.outputSpeech?.text).toContain(
        "¿Apunto Psicotécnico mañana a las 18:00? Di sí o no.",
      );
      expect(r.response.shouldEndSession).toBe(false);
      expect(r.sessionAttributes?.porConfirmar).toHaveLength(1);
      expect(t.entrada).toHaveBeenCalledTimes(1); // la cita, aún no

      const cita = { tipo: "cita", texto: "Psicotécnico", fecha: "2026-11-28", hora: "18:00" };
      t.entrada.mockClear();
      const si = await di({ name: "AMAZON.YesIntent" }, { atributos: { porConfirmar: [cita] } });
      expect(si).toMatch(/^(Apuntado|Anotado|Listo)\.$/);
      expect(t.entrada).toHaveBeenCalledWith(TOKEN, cita);
      t.entrada.mockClear();
      const no = await completa(
        await pedir(
          { name: "AMAZON.NoIntent" },
          { atributos: { porConfirmar: [cita, { ...cita, texto: "Otra" }] } },
        ),
      );
      expect(t.entrada).not.toHaveBeenCalled();
      expect(no.response.outputSpeech?.text).toContain("¿Apunto Otra");
      expect(await di({ name: "AMAZON.YesIntent" })).toContain("nada pendiente");
    });

    it("un recordatorio con hora lo pone Alexa, si hay permiso", async () => {
      t.frase.mockResolvedValue([
        item({ tipo: "recordatorio", titulo: "sacar la basura", hora: "06:00", ambigua: true }),
      ]);
      const sistema = {
        apiAccessToken: "tok",
        apiEndpoint: "https://api.eu.amazonalexa.com",
        user: { permissions: { consentToken: "consentimiento" } },
      };
      const r = await di(frase("recuérdame a las seis sacar la basura"), { sistema });
      expect(r).toBe("Te lo recordaré hoy a las 18:00: sacar la basura.");
      expect(t.recordatorio).toHaveBeenCalledWith(
        { token: "tok", endpoint: "https://api.eu.amazonalexa.com" },
        { texto: "sacar la basura", fecha: "2026-11-27", hora: "18:00" },
      );
    });

    it("sin permiso, lo pide con una tarjeta en la app de Alexa", async () => {
      t.frase.mockResolvedValue([
        item({ tipo: "recordatorio", titulo: "sacar la basura", hora: "18:00" }),
      ]);
      const r = await completa(
        await pedir(frase("recuérdame a las seis de la tarde sacar la basura")),
      );
      expect(t.recordatorio).not.toHaveBeenCalled();
      expect(r.response.outputSpeech?.text).toContain("necesito tu permiso");
      expect(r.response.card).toEqual({
        type: "AskForPermissionsConsent",
        permissions: ["alexa::alerts:reminders:skill:readwrite"],
      });
      // Con permiso, pero rechazado por Alexa: también lo pide.
      t.recordatorio.mockResolvedValue("sin-permiso");
      const sistema = {
        apiAccessToken: "t",
        apiEndpoint: "https://api.eu.amazonalexa.com",
        user: { permissions: { consentToken: "c" } },
      };
      expect(
        (await completa(await pedir(frase("recuérdame sacar la basura"), { sistema }))).response
          .card?.type,
      ).toBe("AskForPermissionsConsent");
      t.recordatorio.mockResolvedValue("fallo");
      expect(await di(frase("recuérdame sacar la basura"), { sistema })).toContain(
        "No he podido poner el recordatorio",
      );
    });

    it("si la IA no entiende, o se gasta el cupo, o falla, lo dice", async () => {
      expect(await di(frase("blablá"))).toContain("No he entendido");
      t.usoIa.mockResolvedValue("tope");
      expect(await di(frase("compra pan"))).toContain("cupo");
      expect(t.frase).toHaveBeenCalledTimes(1);
      t.usoIa.mockResolvedValue(null);
      expect(await di(frase("compra pan"))).toContain("No encuentro vuestra casa");
      t.usoIa.mockResolvedValue("ok");
      t.frase.mockRejectedValue(new Error("ia-tiempo"));
      expect(await di(frase("compra pan"))).toContain("No he podido entenderlo");
      expect(
        (await completa(await pedir({ name: "ConchiIntent" }))).response.shouldEndSession,
      ).toBe(false);
    });
  });

  describe("tareas de casa y quién habla", () => {
    it("«ya he hecho la lavadora» marca la tarea y avisa; si no la encuentra, pregunta", async () => {
      expect(await di({ name: "HechoIntent", slots: slot("tarea", "la lavadora") })).toBe(
        "Marcado como hecho: Poner la lavadora.",
      );
      expect(t.entrada).toHaveBeenCalledWith(TOKEN, {
        tipo: "hecha",
        texto: "Poner la lavadora",
        fecha: null,
        hora: null,
      });
      expect(t.avisar).toHaveBeenCalled();
      t.entrada.mockClear();
      expect(await di({ name: "HechoIntent", slots: slot("tarea", "la colada") })).toContain(
        "No sé qué tarea",
      );
      expect(t.entrada).not.toHaveBeenCalled();
    });

    it("«soy Diego» vincula la voz; sin perfil de voz, lo explica", async () => {
      const sistema = { person: { personId: VOZ } };
      expect(await di({ name: "SoyIntent", slots: slot("nombre", "Diego") }, { sistema })).toBe(
        "Encantada, Diego. Ya sé cuál es tu voz.",
      );
      expect(t.vincular).toHaveBeenCalledWith(TOKEN, VOZ, "diego");
      expect(await di({ name: "SoyIntent", slots: slot("nombre", "Pepe") }, { sistema })).toContain(
        "No encuentro a nadie",
      );
      expect(await di({ name: "SoyIntent", slots: slot("nombre", "Diego") })).toContain(
        "perfil de voz",
      );
    });

    it("«qué me toca» según quién habla", async () => {
      const sistema = { person: { personId: VOZ } };
      expect(await di({ name: "QueMeTocaIntent" }, { sistema })).toContain(
        "Todavía no sé quién eres",
      );
      expect(await di({ name: "QueMeTocaIntent" })).toContain("Todavía no sé quién eres");
      t.persona.mockResolvedValue("diego");
      expect(await di({ name: "QueMeTocaIntent" }, { sistema })).toBe(
        "Hoy te toca: Poner la lavadora y Sacar la basura.",
      );
    });

    it("saluda con el nombre si reconoce la voz", async () => {
      t.persona.mockResolvedValue("diego");
      const r = await di(undefined, {
        tipo: "LaunchRequest",
        sistema: { person: { personId: VOZ } },
      });
      expect(r).toBe("Buenos días, Diego. Soy Conchi. ¿Qué apunto, o qué quieres saber?");
      expect(await di(undefined, { tipo: "LaunchRequest" })).toBe(
        "Buenos días. Soy Conchi. ¿Qué apunto, o qué quieres saber?",
      );
    });
  });

  describe("preguntas libres", () => {
    const pregunta = (valor: string) => ({
      name: "PreguntaIntent",
      slots: slot("pregunta", valor),
    });
    it("la IA contesta con los datos de la casa", async () => {
      t.pregunta.mockResolvedValue("Fue el sábado 14 de noviembre.");
      expect(await di(pregunta("fue la última vez que cambiamos las sábanas"))).toBe(
        "Fue el sábado 14 de noviembre.",
      );
      const llamada = t.pregunta.mock.calls[0]?.[0] as { datos: string; hoy: string };
      expect(llamada.hoy).toBe("2026-11-27");
      expect(llamada.datos).toContain("Poner la lavadora");
    });
    it("sin respuesta, cupo, sin casa y errores", async () => {
      expect(await di(pregunta("cuál es el sentido de la vida"))).toBe("Eso no lo tengo apuntado.");
      t.usoIa.mockResolvedValue("tope");
      expect(await di(pregunta("algo"))).toContain("cupo");
      t.usoIa.mockResolvedValue(null);
      expect(await di(pregunta("algo"))).toContain("No encuentro vuestra casa");
      t.usoIa.mockResolvedValue("ok");
      t.pregunta.mockRejectedValue(new Error("ia-tiempo"));
      expect(await di(pregunta("algo"))).toContain("No he podido pensarlo");
      expect(await di({ name: "PreguntaIntent" })).toBe("¿Qué quieres saber?");
    });
  });

  describe("lo que lee", () => {
    it("la cena y lo de hoy y mañana", async () => {
      expect(await di({ name: "CenaIntent" })).toBe("Hoy de cena: Pisto.");
      expect(await di({ name: "HoyIntent" })).toBe("Hoy no tienes nada apuntado.");
      expect(await di({ name: "MananaIntent" })).toBe("Mañana tienes Pediatra.");
    });
    it("casa, mochila, tiempo, pendientes, papeles y resumen", async () => {
      expect(await di({ name: "CasaIntent" })).toBe(
        "Hoy toca en casa: Poner la lavadora y Sacar la basura.",
      );
      expect(await di({ name: "MochilaIntent" })).toContain("No hay nada que preparar");
      expect(await di({ name: "TiempoIntent" })).toContain("tiempo");
      expect(await di({ name: "PendientesIntent" })).toBe("Hay un pendiente: Llamar al fontanero.");
      expect(await di({ name: "PapelesIntent" })).toBe(
        "Vence pronto: ITV, el viernes 4 de diciembre.",
      );
      expect(await di({ name: "AvisosIntent" })).toContain("Poner la lavadora");
    });
    it("el Metropolitano", async () => {
      expect(await di({ name: "EstadioIntent" })).toBe("Hoy no hay nada en el Metropolitano.");
      t.estadio.mockResolvedValue([
        {
          id: "1",
          fecha: "2026-11-27",
          hora: "21:00",
          tipo: "partido",
          titulo: "Atlético – Betis",
        },
      ]);
      expect(await di({ name: "EstadioIntent" })).toContain("Atlético – Betis");
    });
    it("sin casa, avisa", async () => {
      t.resumen.mockResolvedValue(null);
      expect(await di({ name: "CenaIntent" })).toContain("No encuentro vuestra casa");
    });
  });

  it("ayuda, parar, abrir y errores", async () => {
    expect(await di({ name: "AMAZON.HelpIntent" })).toContain("añade leche");
    expect(await di({ name: "AMAZON.StopIntent" })).toMatch(
      /^(Vale|Hasta luego|Cuando quieras)\.$/,
    );
    expect(await di(undefined, { tipo: "LaunchRequest" })).toContain("¿Qué apunto");
    expect((await pedir(undefined, { tipo: "SessionEndedRequest" })).status).toBe(200);
    t.resumen.mockRejectedValue(new Error("caído"));
    expect(await di({ name: "HoyIntent" })).toContain("Ahora mismo no consigo");
  });
});
