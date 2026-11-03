import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  acceso: { ok: true, usadas: 2, limite: 40 } as
    { ok: true; usadas: number; limite: number } | { ok: false; respuesta: Response },
  transcribir: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/infraestructura/ia/acceso", () => ({
  comprobarAccesoIa: async () => estado.acceso,
  responderIa: (cuerpo: unknown, status: number) =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));
vi.mock("@/infraestructura/ia/cole", () => ({ transcribirMenuCole: estado.transcribir }));
vi.mock("@/infraestructura/ia/lista", () => ({
  IaNoConfigurada: class IaNoConfigurada extends Error {},
}));

import { POST } from "./route";

const pedir = (archivo?: File | string) => {
  const datos = new FormData();
  if (archivo !== undefined) datos.append("archivo", archivo);
  return POST(new Request("http://localhost/api/ia/cole", { method: "POST", body: datos }));
};
const pdf = (n = 100) => new File([new Uint8Array(n)], "menu.pdf", { type: "application/pdf" });

beforeEach(() => {
  estado.acceso = { ok: true, usadas: 2, limite: 40 };
  estado.transcribir.mockReset().mockResolvedValue("MENÚ Noviembre 2026\n3\nLentejas");
});

describe("POST /api/ia/cole", () => {
  it("devuelve el texto transcrito y cuenta el uso", async () => {
    const r = await pedir(pdf());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      texto: "MENÚ Noviembre 2026\n3\nLentejas",
      usadas: 2,
      limite: 40,
    });
    expect(estado.transcribir).toHaveBeenCalledWith({
      mime: "application/pdf",
      base64: expect.any(String),
    });
  });

  it("rechaza lo que no es un archivo válido sin gastar IA", async () => {
    expect((await pedir()).status).toBe(400);
    expect((await pedir("texto suelto")).status).toBe(400);
    expect((await pedir(new File([], "vacio.pdf", { type: "application/pdf" }))).status).toBe(400);
    expect(
      (await pedir(new File([new Uint8Array(10)], "a.zip", { type: "application/zip" }))).status,
    ).toBe(415);
    expect((await pedir(pdf(9 * 1024 * 1024))).status).toBe(413);
    expect(estado.transcribir).not.toHaveBeenCalled();
  });

  it("si el acceso se deniega (sin sesión, tope, sin clave) no se llama a la IA", async () => {
    estado.acceso = { ok: false, respuesta: new Response("{}", { status: 429 }) };
    expect((await pedir(pdf())).status).toBe(429);
    expect(estado.transcribir).not.toHaveBeenCalled();
  });

  it("un fallo del proveedor no filtra detalles", async () => {
    estado.transcribir.mockRejectedValue(new Error("secreto del proveedor"));
    const r = await pedir(pdf());
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain("secreto");
  });
});
