import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { claveVapidPublica, enviarPush, generarClavesVapid, pushConfigurado } from "./push";

const sub = {
  endpoint: "https://push.example.test/abc",
  keys: { p256dh: "p".repeat(30), auth: "a".repeat(12) },
};
const msg = { titulo: "Hola", cuerpo: "Cuerpo" };

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VAPID_PUBLIC_KEY", "publica");
  vi.stubEnv("VAPID_PRIVATE_KEY", "privada");
});

describe("push", () => {
  it("está configurado solo con las dos claves", () => {
    expect(pushConfigurado()).toBe(true);
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(pushConfigurado()).toBe(false);
    expect(claveVapidPublica()).toBe("publica");
  });

  it("genera un par de claves distinto cada vez", () => {
    const a = generarClavesVapid();
    const b = generarClavesVapid();
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.privateKey).toHaveLength(43);
  });

  it("envía el mensaje como JSON con las claves VAPID y un tiempo de vida", async () => {
    const enviar = vi.fn().mockResolvedValue({});
    expect(await enviarPush(sub, msg, enviar as never)).toBe("ok");
    const [s, cuerpo, opciones] = enviar.mock.calls[0] as [
      unknown,
      string,
      Record<string, unknown>,
    ];
    expect(s).toBe(sub);
    expect(JSON.parse(cuerpo)).toEqual(msg);
    expect(opciones.TTL).toBeGreaterThan(0);
    expect(opciones.vapidDetails).toMatchObject({ publicKey: "publica", privateKey: "privada" });
  });

  it("404 y 410 son «caducada»; otros fallos, «fallo»", async () => {
    const con = (statusCode: number) =>
      vi.fn().mockRejectedValue(Object.assign(new Error("x"), { statusCode }));
    expect(await enviarPush(sub, msg, con(410) as never)).toBe("caducada");
    expect(await enviarPush(sub, msg, con(404) as never)).toBe("caducada");
    expect(await enviarPush(sub, msg, con(500) as never)).toBe("fallo");
    expect(await enviarPush(sub, msg, vi.fn().mockRejectedValue(new Error("red")) as never)).toBe(
      "fallo",
    );
  });

  it("sin claves no intenta enviar", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    const enviar = vi.fn();
    expect(await enviarPush(sub, msg, enviar as never)).toBe("fallo");
    expect(enviar).not.toHaveBeenCalled();
  });
});
