import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  anadirEntradaAlexa,
  avisarALaFamilia,
  deshacerLoUltimoDeAlexa,
  leerCompraDeAlexa,
  personaDeLaVoz,
  usarIaAlexa,
  vincularVozDeAlexa,
} from "./alexa";

const TOKEN = "a".repeat(64);
let pedido: { url: string; cuerpo: unknown } | null = null;
const responder = (valor: unknown, status = 200) => {
  pedido = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      pedido = { url, cuerpo: JSON.parse(init.body as string) };
      return new Response(JSON.stringify(valor), { status });
    }),
  );
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "clave");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("llamadas de Conchi a la base de datos (D-215, D-216)", () => {
  it("guarda una entrada con su tipo, día y hora", async () => {
    responder("ok");
    const r = await anadirEntradaAlexa(TOKEN, {
      tipo: "cita",
      texto: "dentista",
      fecha: "2026-12-03",
      hora: "17:00",
    });
    expect(r).toBe("ok");
    expect(pedido).toEqual({
      url: "https://x.supabase.test/rest/v1/rpc/alexa_anadir",
      cuerpo: {
        p_token: TOKEN,
        p_tipo: "cita",
        p_texto: "dentista",
        p_fecha: "2026-12-03",
        p_hora: "17:00",
      },
    });
  });

  it("cuenta la IA, deshace y lee la compra", async () => {
    responder("tope");
    expect(await usarIaAlexa(TOKEN)).toBe("tope");
    responder({ tipo: "compra", texto: "leche" });
    expect(await deshacerLoUltimoDeAlexa(TOKEN)).toEqual({ tipo: "compra", texto: "leche" });
    responder(null);
    expect(await deshacerLoUltimoDeAlexa(TOKEN)).toBeNull();
    responder(["Leche", 5, "Pan"]);
    expect(await leerCompraDeAlexa(TOKEN)).toEqual(["Leche", "Pan"]);
    responder(null);
    expect(await leerCompraDeAlexa(TOKEN)).toBeNull();
  });

  it("avisa a la familia y vincula voces", async () => {
    responder(true);
    expect(await avisarALaFamilia(TOKEN, "leche")).toBe(true);
    responder(false);
    expect(await avisarALaFamilia(TOKEN, "leche")).toBe(false);
    responder("ok");
    expect(await vincularVozDeAlexa(TOKEN, "amzn1.ask.person.X", "diego")).toBe("ok");
    expect(pedido?.cuerpo).toEqual({
      p_token: TOKEN,
      p_voz: "amzn1.ask.person.X",
      p_persona: "diego",
    });
    responder("diego");
    expect(await personaDeLaVoz(TOKEN, "amzn1.ask.person.X")).toBe("diego");
    responder(null);
    expect(await personaDeLaVoz(TOKEN, "amzn1.ask.person.X")).toBeNull();
  });

  it("si Supabase falla o no está configurado, lanza", async () => {
    responder({}, 500);
    await expect(usarIaAlexa(TOKEN)).rejects.toThrow("supabase-no-responde");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(usarIaAlexa(TOKEN)).rejects.toThrow("supabase-no-configurado");
  });
});
