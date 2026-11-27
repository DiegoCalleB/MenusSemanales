import { describe, expect, it, vi } from "vitest";
import { ponerRecordatorio } from "./alexa-recordatorios";

const ACCESO = { token: "tok", endpoint: "https://api.eu.amazonalexa.com" };
const E = { texto: "sacar la basura", fecha: "2026-11-27", hora: "18:00" };
const AHORA = new Date("2026-11-27T09:00:00Z");
const con = (status: number) => vi.fn().mockResolvedValue(new Response("{}", { status }));

describe("ponerRecordatorio (D-216)", () => {
  it("llama a la API de recordatorios con el permiso de quien habla", async () => {
    const pedir = con(201);
    expect(await ponerRecordatorio(ACCESO, E, AHORA, pedir as unknown as typeof fetch)).toBe("ok");
    const [url, init] = pedir.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.eu.amazonalexa.com/v1/alerts/reminders");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string).trigger.scheduledTime).toBe("2026-11-27T18:00:00.000");
  });
  it("sin permiso o con error, lo dice", async () => {
    expect(await ponerRecordatorio(ACCESO, E, AHORA, con(403) as unknown as typeof fetch)).toBe(
      "sin-permiso",
    );
    expect(await ponerRecordatorio(ACCESO, E, AHORA, con(401) as unknown as typeof fetch)).toBe(
      "sin-permiso",
    );
    expect(await ponerRecordatorio(ACCESO, E, AHORA, con(500) as unknown as typeof fetch)).toBe(
      "fallo",
    );
    expect(
      await ponerRecordatorio(
        ACCESO,
        E,
        AHORA,
        vi.fn().mockRejectedValue(new Error("red")) as unknown as typeof fetch,
      ),
    ).toBe("fallo");
  });
  it("no llama a servidores que no son de Alexa", async () => {
    const pedir = con(201);
    expect(
      await ponerRecordatorio(
        { token: "t", endpoint: "https://evil.example.com" },
        E,
        AHORA,
        pedir as unknown as typeof fetch,
      ),
    ).toBe("fallo");
    expect(
      await ponerRecordatorio(
        { token: "t", endpoint: "http://api.amazonalexa.com" },
        E,
        AHORA,
        pedir as unknown as typeof fetch,
      ),
    ).toBe("fallo");
    expect(pedir).not.toHaveBeenCalled();
  });
});
