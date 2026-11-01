import { describe, expect, it } from "vitest";
import { cabecerasSeguridad } from "./cabeceras";

const valor = (clave: string) => cabecerasSeguridad.find((c) => c.key === clave)?.value;

describe("cabecerasSeguridad", () => {
  it("incluye todas las cabeceras obligatorias", () => {
    for (const clave of [
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ]) {
      expect(valor(clave), clave).toBeTruthy();
    }
  });

  it("HSTS dura al menos un año", () => {
    const maxAge = Number(/max-age=(\d+)/.exec(valor("Strict-Transport-Security") ?? "")?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
  });

  it("bloquea iframes y deniega cámara, micrófono y ubicación", () => {
    expect(valor("X-Frame-Options")).toBe("DENY");
    expect(valor("Permissions-Policy")).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  });
});
