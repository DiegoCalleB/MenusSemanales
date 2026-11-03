import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MODELO_RESPALDO, llamarGemini } from "./gemini";

const respuesta = (status: number) => new Response("{}", { status });
const sinEspera = async () => {};
const urlDe = (f: ReturnType<typeof vi.fn>, n: number) => String(f.mock.calls[n]?.[0]);

describe("llamarGemini", () => {
  it("devuelve la respuesta si va bien a la primera", async () => {
    const f = vi.fn().mockResolvedValue(respuesta(200));
    const r = await llamarGemini("k", {}, { plazoMs: 5000, llamar: f, espera: sinEspera });
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("reintenta un 503 y acaba funcionando", async () => {
    const f = vi.fn().mockResolvedValueOnce(respuesta(503)).mockResolvedValueOnce(respuesta(200));
    const r = await llamarGemini("k", {}, { plazoMs: 5000, llamar: f, espera: sinEspera });
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("si el principal sigue saturado prueba con el modelo de respaldo", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(respuesta(503))
      .mockResolvedValueOnce(respuesta(503))
      .mockResolvedValueOnce(respuesta(200));
    await llamarGemini("k", {}, { plazoMs: 5000, llamar: f, espera: sinEspera });
    expect(urlDe(f, 2)).toContain(MODELO_RESPALDO);
  });

  it("si todo falla, lanza el último código", async () => {
    const f = vi.fn().mockResolvedValue(respuesta(503));
    await expect(
      llamarGemini("k", {}, { plazoMs: 5000, llamar: f, espera: sinEspera }),
    ).rejects.toThrow("ia-http-503");
  });

  it("no reintenta errores que no son pasajeros (p. ej. clave mala)", async () => {
    const f = vi.fn().mockResolvedValue(respuesta(403));
    await expect(
      llamarGemini("k", {}, { plazoMs: 5000, llamar: f, espera: sinEspera }),
    ).rejects.toThrow("ia-http-403");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("si el modelo rechaza un ajuste opcional (400) repite con el cuerpo simple", async () => {
    const f = vi.fn().mockResolvedValueOnce(respuesta(400)).mockResolvedValueOnce(respuesta(200));
    const r = await llamarGemini(
      "k",
      { con: true },
      { plazoMs: 5000, llamar: f, espera: sinEspera, sinAjustes: { con: false } },
    );
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
    expect(urlDe(f, 0)).toBe(urlDe(f, 1));
    expect((f.mock.calls[1]?.[1] as RequestInit).body).toBe('{"con":false}');
  });

  it("la clave va en la cabecera, nunca en la URL", async () => {
    const f = vi.fn().mockResolvedValue(respuesta(200));
    await llamarGemini("secreta", {}, { plazoMs: 5000, llamar: f, espera: sinEspera });
    expect(urlDe(f, 0)).not.toContain("secreta");
    expect((f.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({
      "x-goog-api-key": "secreta",
    });
  });
});
