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

const ENLACE = "a".repeat(64);
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
    const r = await anadirEntradaAlexa(ENLACE, {
      tipo: "cita",
      texto: "dentista",
      fecha: "2026-12-03",
      hora: "17:00",
    });
    expect(r).toBe("ok");
    expect(pedido).toEqual({
      url: "https://x.supabase.test/rest/v1/rpc/alexa_anadir",
      cuerpo: {
        p_token: ENLACE,
        p_tipo: "cita",
        p_texto: "dentista",
        p_fecha: "2026-12-03",
        p_hora: "17:00",
      },
    });
  });

  it("cuenta la IA, deshace y lee la compra", async () => {
    responder("tope");
    expect(await usarIaAlexa(ENLACE)).toBe("tope");
    responder({ tipo: "compra", texto: "leche" });
    expect(await deshacerLoUltimoDeAlexa(ENLACE)).toEqual({ tipo: "compra", texto: "leche" });
    responder(null);
    expect(await deshacerLoUltimoDeAlexa(ENLACE)).toBeNull();
    responder(["Leche", 5, "Pan"]);
    expect(await leerCompraDeAlexa(ENLACE)).toEqual(["Leche", "Pan"]);
    responder(null);
    expect(await leerCompraDeAlexa(ENLACE)).toBeNull();
  });

  it("avisa a la familia y vincula voces", async () => {
    responder(true);
    expect(await avisarALaFamilia(ENLACE, "leche")).toBe(true);
    responder(false);
    expect(await avisarALaFamilia(ENLACE, "leche")).toBe(false);
    responder("ok");
    expect(await vincularVozDeAlexa(ENLACE, "voz-de-prueba-uno", "diego")).toBe("ok");
    expect(pedido?.cuerpo).toEqual({
      p_token: ENLACE,
      p_voz: "voz-de-prueba-uno",
      p_persona: "diego",
    });
    responder("diego");
    expect(await personaDeLaVoz(ENLACE, "voz-de-prueba-uno")).toBe("diego");
    responder(null);
    expect(await personaDeLaVoz(ENLACE, "voz-de-prueba-uno")).toBeNull();
  });

  it("si Supabase falla o no está configurado, lanza", async () => {
    responder({}, 500);
    await expect(usarIaAlexa(ENLACE)).rejects.toThrow("supabase-no-responde");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(usarIaAlexa(ENLACE)).rejects.toThrow("supabase-no-configurado");
  });
});
