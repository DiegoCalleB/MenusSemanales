import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { CorreoNoConfigurado, enviarCorreo } from "./resend";

const correo = {
  para: ["a@b.test"],
  asunto: "Hola",
  texto: "t",
  html: "<p>t</p>",
  clave: "resumen-2026-11-03",
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("RESEND_API_KEY", "re_clave_de_prueba");
});

describe("enviarCorreo", () => {
  it("sin clave lanza CorreoNoConfigurado", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(enviarCorreo(correo, vi.fn())).rejects.toBeInstanceOf(CorreoNoConfigurado);
  });

  it("envía a Resend con la clave en la cabecera, no en la URL, y la clave de idempotencia", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await enviarCorreo(correo, f);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(url).not.toContain("re_clave");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer re_clave_de_prueba");
    expect(h["Idempotency-Key"]).toBe("resumen-2026-11-03");
    const cuerpo = JSON.parse(String(init.body));
    expect(cuerpo).toMatchObject({
      to: ["a@b.test"],
      subject: "Hola",
      from: expect.stringContaining("resend.dev"),
    });
  });

  it("usa el remitente configurado", async () => {
    vi.stubEnv("AVISOS_DE", "Menús <avisos@midominio.test>");
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await enviarCorreo(correo, f);
    expect(JSON.parse(String((f.mock.calls[0]?.[1] as RequestInit).body)).from).toBe(
      "Menús <avisos@midominio.test>",
    );
  });

  it("si Resend responde con error, lanza con el código y sin su cuerpo", async () => {
    const f = vi.fn().mockResolvedValue(new Response("detalle interno", { status: 403 }));
    await expect(enviarCorreo(correo, f)).rejects.toThrow("correo-http-403");
  });
});
