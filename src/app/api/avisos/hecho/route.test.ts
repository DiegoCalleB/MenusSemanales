import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ marcar: vi.fn() }));
vi.mock("@/infraestructura/avisos/claves", () => ({ marcarHechoDesdeAviso: m.marcar }));

import { POST } from "./route";

const pedir = (cuerpo: unknown) =>
  POST(
    new Request("http://localhost/api/avisos/hecho", {
      method: "POST",
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    }),
  );

beforeEach(() => {
  m.marcar.mockReset().mockResolvedValue(1);
});

describe("POST /api/avisos/hecho (D-151)", () => {
  it("con un código bueno marca y dice cuántas", async () => {
    const r = await pedir({ codigo: "e".repeat(64) });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ marcadas: 1 });
    expect(m.marcar).toHaveBeenCalledWith("e".repeat(64));
  });

  it("con algo que no es un código, 400 sin preguntar a la base de datos", async () => {
    for (const c of [{}, { codigo: "x" }, { codigo: "E".repeat(64) }, "no es json"]) {
      expect((await pedir(c)).status).toBe(400);
    }
    expect(m.marcar).not.toHaveBeenCalled();
  });

  it("si el código no vale o ha caducado, 404", async () => {
    m.marcar.mockResolvedValue(null);
    expect((await pedir({ codigo: "e".repeat(64) })).status).toBe(404);
  });

  it("si la base de datos falla, 502", async () => {
    m.marcar.mockRejectedValue(new Error("caída"));
    expect((await pedir({ codigo: "e".repeat(64) })).status).toBe(502);
  });
});
