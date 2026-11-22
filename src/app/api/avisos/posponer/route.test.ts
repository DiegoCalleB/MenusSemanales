import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ posponer: vi.fn() }));
vi.mock("@/infraestructura/avisos/claves", () => ({ posponerAviso: m.posponer }));

import { POST } from "./route";

const pedir = (cuerpo: unknown) =>
  POST(
    new Request("http://localhost/api/avisos/posponer", {
      method: "POST",
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    }),
  );

beforeEach(() => {
  m.posponer.mockReset().mockResolvedValue(true);
});

describe("POST /api/avisos/posponer (D-204)", () => {
  it("con un código bueno lo pospone", async () => {
    const r = await pedir({ codigo: "e".repeat(64) });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ pospuesto: true });
    expect(m.posponer).toHaveBeenCalledWith("e".repeat(64));
  });

  it("con algo que no es un código, 400 sin preguntar a la base de datos", async () => {
    for (const c of [{}, { codigo: "x" }, { codigo: "E".repeat(64) }, "no es json"]) {
      expect((await pedir(c)).status).toBe(400);
    }
    expect(m.posponer).not.toHaveBeenCalled();
  });

  it("si el código no vale (o ya se pospuso 3 veces), 404", async () => {
    m.posponer.mockResolvedValue(false);
    expect((await pedir({ codigo: "e".repeat(64) })).status).toBe(404);
  });

  it("si la base de datos no contesta, 502", async () => {
    m.posponer.mockRejectedValue(new Error("no"));
    expect((await pedir({ codigo: "e".repeat(64) })).status).toBe(502);
  });
});
