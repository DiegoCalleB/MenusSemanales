import { describe, expect, it } from "vitest";
import {
  hablarDeHoy,
  hablarDeLaCena,
  hablarDeLaCompra,
  hoyParaAlexa,
  peticionAlexaSchema,
  productosDe,
  respuesta,
  skillDe,
} from "./alexa";
import type { ProyeccionCalendario } from "./calendario-suscrito";

const resumen = (extra: Partial<ProyeccionCalendario> = {}): ProyeccionCalendario =>
  ({
    personas: [],
    cenas: [],
    almuerzos: [],
    eventos: {},
    agenda: [],
    casa: [],
    ...extra,
  }) as unknown as ProyeccionCalendario;

describe("alexa: lo que se entiende", () => {
  it("separa los productos y quita lo que sobra", () => {
    expect(productosDe("leche")).toEqual(["leche"]);
    expect(productosDe("Leche y pan")).toEqual(["leche", "pan"]);
    expect(productosDe("leche, pan y huevos")).toEqual(["leche", "pan", "huevos"]);
    expect(productosDe("una barra de pan a la compra")).toEqual(["barra de pan"]);
    expect(productosDe("papel higiénico en la lista de la compra")).toEqual(["papel higiénico"]);
    expect(productosDe("la leche y los huevos")).toEqual(["leche", "huevos"]);
    expect(productosDe("más pan")).toEqual(["pan"]);
    expect(productosDe("   ")).toEqual([]);
    expect(productosDe(undefined)).toEqual([]);
    expect(productosDe("a, b, c, d, e, f, g")).toHaveLength(5);
    expect(productosDe("x".repeat(81))).toEqual([]);
  });

  it("lee la petición y de qué skill viene", () => {
    const p = peticionAlexaSchema.parse({
      context: { System: { application: { applicationId: "amzn1.ask.skill.1" } } },
      request: {
        type: "IntentRequest",
        intent: {
          name: "AnadirCompraIntent",
          slots: { producto: { name: "producto", value: "leche" } },
        },
      },
    });
    expect(skillDe(p)).toBe("amzn1.ask.skill.1");
    expect(p.request.intent?.slots?.producto?.value).toBe("leche");
    expect(peticionAlexaSchema.safeParse({ request: {} }).success).toBe(false);
  });

  it("el día cambia a las 4:00, hora de Madrid", () => {
    expect(hoyParaAlexa(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-04"); // 00:30 del 5
    expect(hoyParaAlexa(new Date("2026-11-05T03:30:00Z"))).toBe("2026-11-05"); // 04:30
  });
});

describe("alexa: lo que contesta", () => {
  it("la compra: apuntado, o por qué no", () => {
    expect(hablarDeLaCompra(["leche"], ["ok"])).toBe("Apuntado en la compra: leche.");
    expect(hablarDeLaCompra(["leche", "pan"], ["ok", "ok"])).toBe(
      "Apuntado en la compra: leche y pan.",
    );
    expect(hablarDeLaCompra(["leche"], ["demasiadas"])).toContain("muchas cosas");
    expect(hablarDeLaCompra(["leche", "pan"], ["ok", "demasiadas"])).toContain("He apuntado leche");
    expect(hablarDeLaCompra(["leche"], ["no-valido"])).toContain("No he podido");
  });

  it("la cena, y el cole si hay", () => {
    const p = resumen({
      cenas: [{ fecha: "2026-11-04", nombre: "Pisto con huevo" }],
      cole: [{ fecha: "2026-11-04", primero: "Lentejas", segundo: "Pollo", postre: null }],
    });
    expect(hablarDeLaCena(p, "2026-11-04")).toBe(
      "Hoy de cena: Pisto con huevo. En el cole han comido Lentejas y Pollo.",
    );
    expect(hablarDeLaCena(p, "2026-11-05")).toBe("Hoy no hay cena apuntada.");
  });

  it("hoy: solo citas y fechas señaladas, con hora si la tienen", () => {
    const p = resumen({
      eventos: { "2026-11-04": { titulo: "Día del padre", emoji: "👨" } },
      agenda: [
        { fecha: "2026-11-04", hasta: null, hora: "18:15", titulo: "Psicotécnico" },
        { fecha: "2026-11-04", hasta: null, hora: "09:00", titulo: "Dentista" },
        { fecha: "2026-11-09", hasta: null, hora: null, titulo: "Otro día" },
      ],
      casa: [
        {
          titulo: "Sábanas",
          emoji: "🛏️",
          cadaDias: 7,
          responsableId: null,
          ultimaVez: null,
          desde: "2026-11-01",
        },
      ],
    });
    expect(hablarDeHoy(p, "2026-11-04")).toBe(
      "Hoy tienes Día del padre, Dentista a las 9:00 y Psicotécnico a las 18:15.",
    );
    expect(hablarDeHoy(p, "2026-11-06")).toBe("Hoy no tienes nada apuntado.");
  });

  it("el formato de Alexa: cerrar o seguir hablando", () => {
    expect(respuesta("hola").response.shouldEndSession).toBe(true);
    const sigue = respuesta("hola", true);
    expect(sigue.response.shouldEndSession).toBe(false);
    expect(sigue.response.reprompt?.outputSpeech.text).toContain("añade leche");
  });
});
