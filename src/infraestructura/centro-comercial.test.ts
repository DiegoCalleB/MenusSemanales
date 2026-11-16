import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leerPlanesDelCentro } from "./centro-comercial";

const POSTS = [
  {
    id: 10,
    date: "2026-10-19T13:53:09",
    modified: "2026-10-30T09:41:03",
    link: "https://www.cclasrosas.es/eventos/misterio-en-las-rosas/",
    title: { rendered: "Misterio en Las Rosas" },
    content: { rendered: "<p>6, 7 y 8 de noviembre</p>" },
  },
];
const LEIDO = {
  eventos: [
    {
      entradaId: 10,
      titulo: "Misterio en Las Rosas",
      fechas: ["2026-11-06", "2026-11-07"],
      hora: "18:00",
      gratis: true,
      familiar: true,
      tipo: "juego",
    },
  ],
};
const pedir = (posts: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(posts), { status }));
const gemini = (leido: unknown, status = 200) =>
  vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: JSON.stringify(leido) }] } },
        ],
      }),
      { status },
    ),
  );

beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "clave"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("leerPlanesDelCentro (D-172)", () => {
  it("sin clave de la IA no hace nada", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const informe: { centro?: string } = {};
    expect(await leerPlanesDelCentro("2026-11-04", pedir(POSTS) as never, informe)).toEqual([]);
    expect(informe.centro).toBe("sin-ia");
  });

  it("lee la web, pregunta a la IA y devuelve los planes (y la segunda vez no vuelve a preguntar)", async () => {
    const llamada = gemini(LEIDO);
    vi.stubGlobal("fetch", llamada);
    const informe: { centro?: string } = {};
    const p = await leerPlanesDelCentro("2026-11-04", pedir(POSTS) as never, informe);
    expect(p.map((x) => x.fecha)).toEqual(["2026-11-06", "2026-11-07"]);
    expect(informe.centro).toBe("ok: 2 planes");
    expect(llamada).toHaveBeenCalledTimes(1);
    await leerPlanesDelCentro("2026-11-04", pedir(POSTS) as never, informe);
    expect(llamada).toHaveBeenCalledTimes(1);
    expect(informe.centro).toContain("guardado");
  });

  it("si la web, la IA o su respuesta fallan, no hay planes y no se rompe nada", async () => {
    const informe: { centro?: string } = {};
    expect(await leerPlanesDelCentro("2026-11-05", pedir([], 503) as never, informe)).toEqual([]);
    expect(informe.centro).toBe("error: http-503");
    vi.stubGlobal("fetch", gemini({ eventos: "mal" }));
    expect(
      await leerPlanesDelCentro(
        "2026-11-06",
        pedir([{ ...POSTS[0], modified: "otra" }]) as never,
        informe,
      ),
    ).toEqual([]);
    expect(informe.centro).toMatch(/^error/);
  });
});
