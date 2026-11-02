import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const TOKEN = "a".repeat(64);
const ctx = (token: string) => ({ params: Promise.resolve({ token }) });
const pedir = (token: string, query = "", ip = "1.1.1.1") =>
  GET(
    new Request(`http://localhost/api/calendario/${token}${query}`, {
      headers: { "x-forwarded-for": ip },
    }),
    ctx(token),
  );
const resumen = {
  personas: [
    { id: "diego", nombre: "Diego", tipo: "adulto", activa: true },
    { id: "ana", nombre: "Ana", tipo: "adulto", activa: true },
  ],
  cenas: [],
  almuerzos: [],
  eventos: {},
  agenda: [{ fecha: "2999-01-01", hasta: null, hora: "18:15", titulo: "Psicotécnico" }],
  casa: [],
  cumples: [{ nombre: "Ana", dia: 7, mes: 11, anio: 1984, personaId: "ana" }],
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/calendario/[token]", () => {
  it("devuelve el calendario (con o sin .ics) y manda solo la clave pública y el token", async () => {
    const fetchSimulado = vi.fn(async () => Response.json(resumen));
    vi.stubGlobal("fetch", fetchSimulado);
    const r = await pedir(`${TOKEN}.ics`, "?para=diego", "2.2.2.2");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/calendar");
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    const ics = await r.text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:📌 Psicotécnico");
    expect(ics).toContain("SUMMARY:🎂 Cumple de Ana");
    // Para Diego, los avisos del regalo de Ana sí; el token no se cuela en el calendario.
    expect(ics).toContain("Pensar el regalo de Ana");
    expect(ics).not.toContain(TOKEN);
    const [url, init] = fetchSimulado.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.supabase.co/rest/v1/rpc/estado_para_calendario");
    expect(JSON.parse(String(init.body))).toEqual({ p_token: TOKEN });
    expect((init.headers as Record<string, string>).apikey).toBe("sb_publishable_test");
  });

  it("a Ana no le salen los avisos de su regalo, y sin «para» tampoco a nadie", async () => {
    vi.stubGlobal("fetch", async () => Response.json(resumen));
    expect(await (await pedir(TOKEN, "?para=ana", "3.3.3.3")).text()).not.toContain("regalo");
    expect(await (await pedir(TOKEN, "", "3.3.3.4")).text()).not.toContain("regalo");
    expect(await (await pedir(TOKEN, "?para=%27%3Bdrop", "3.3.3.5")).text()).not.toContain(
      "regalo",
    );
  });

  it("un token que no existe, está mal formado o no tiene plan da el mismo 404", async () => {
    vi.stubGlobal("fetch", async () => Response.json(null));
    for (const t of [TOKEN, "hola", "", `${"g".repeat(64)}`, "a".repeat(63)]) {
      const r = await pedir(t, "", "4.4.4.4");
      expect(r.status, t).toBe(404);
      expect(await r.text()).toBe("No encontrado");
    }
  });

  it("si Supabase falla o devuelve algo raro, no cuenta detalles", async () => {
    vi.stubGlobal("fetch", async () => new Response("boom secreto", { status: 500 }));
    const caida = await pedir(TOKEN, "", "5.5.5.5");
    expect(caida.status).toBe(502);
    expect(await caida.text()).toBe("No disponible");
    vi.stubGlobal("fetch", async () => Response.json({ cenas: "no" }));
    expect((await pedir(TOKEN, "", "5.5.5.6")).status).toBe(404);
    vi.unstubAllEnvs();
    expect((await pedir(TOKEN, "", "5.5.5.7")).status).toBe(404);
  });

  it("frena a quien pide sin parar", async () => {
    vi.stubGlobal("fetch", async () => Response.json(null));
    let ultimo = 0;
    for (let i = 0; i < 70; i++) ultimo = (await pedir(TOKEN, "", "6.6.6.6")).status;
    expect(ultimo).toBe(429);
    expect((await pedir(TOKEN, "", "7.7.7.7")).status).toBe(404); // otra dirección: sigue bien
  });
});
