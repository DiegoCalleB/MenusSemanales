import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leerEventosEstadio } from "./metropolitano";

const respuesta = (cuerpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));
const concierto = {
  id: "a",
  name: "Bad Bunny",
  dates: { start: { localDate: "2027-02-10", localTime: "21:30:00" } },
  classifications: [{ segment: { name: "Music" } }],
  _embedded: { venues: [{ name: "Riyadh Air Metropolitano" }] },
};
const lejano = {
  ...concierto,
  id: "b",
  name: "Karol G",
  dates: { start: { localDate: "2027-06-24" } },
};

afterEach(() => vi.unstubAllEnvs());

describe("leerEventosEstadio (D-159)", () => {
  it("sin clave de Ticketmaster, solo partidos, y lo dice", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "");
    const informe: { ticketmaster?: string } = {};
    const e = await leerEventosEstadio(
      "2026-11-16",
      vi.fn(() => respuesta({ events: [] })) as never,
      informe,
    );
    expect(e).toEqual([]);
    expect(informe.ticketmaster).toBe("sin-clave");
  });

  it("con clave, pide a Ticketmaster alrededor del estadio y cuenta lo que encuentra", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "clave-de-prueba");
    const llamadas: string[] = [];
    const pedir = vi.fn((url: string) => {
      llamadas.push(url);
      return url.includes("ticketmaster")
        ? respuesta({ page: { totalElements: 3 }, _embedded: { events: [concierto, lejano] } })
        : respuesta({ events: [] });
    });
    const informe: { ticketmaster?: string } = {};
    const e = await leerEventosEstadio("2026-11-16", pedir as never, informe);
    // También el concierto de junio de 2027, que está a siete meses.
    expect(e.map((x) => x.titulo)).toEqual(["Bad Bunny", "Karol G"]);
    expect(informe.ticketmaster).toBe("ok: 3 eventos cerca, 2 en el estadio");
    const tm = llamadas.find((u) => u.includes("ticketmaster"))!;
    expect(tm).toContain("radius=2");
    expect(tm).toContain("locale=*");
    expect(tm).toContain("startDateTime=2026-11-16T00:00:00Z");
    // Los conciertos de verano se anuncian en otoño: se mira más de un año.
    expect(tm).toContain("endDateTime=2028-02-09T23:59:59Z");
    // El informe nunca lleva la clave.
    expect(JSON.stringify(informe)).not.toContain("clave-de-prueba");
  });

  it("si Ticketmaster responde con error, lo dice sin romper los partidos", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "clave-de-prueba");
    const pedir = vi.fn((url: string) =>
      url.includes("ticketmaster") ? respuesta({}, 401) : respuesta({ events: [] }),
    );
    const informe: { ticketmaster?: string } = {};
    await leerEventosEstadio("2026-11-16", pedir as never, informe);
    expect(informe.ticketmaster).toBe("error: http-401");
  });
});
