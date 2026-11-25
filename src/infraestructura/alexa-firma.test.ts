import { X509Certificate, createSign, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cadenaDeConfianza,
  fechaReciente,
  peticionDeAlexa,
  urlDeCertificadosValida,
  type Certificado,
} from "./alexa-firma";

describe("alexa: la dirección de los certificados", () => {
  it("solo vale la de Amazon", () => {
    const buena = "https://s3.amazonaws.com/echo.api/echo-api-cert-7.pem";
    expect(urlDeCertificadosValida(buena)).toBe(true);
    expect(urlDeCertificadosValida("HTTPS://S3.AMAZONAWS.COM:443/echo.api/x.pem")).toBe(true);
    for (const mala of [
      "http://s3.amazonaws.com/echo.api/x.pem",
      "https://s3.amazonaws.com.evil.com/echo.api/x.pem",
      "https://s3.amazonaws.com:8443/echo.api/x.pem",
      "https://s3.amazonaws.com/EcHo.api/x.pem",
      "https://s3.amazonaws.com/invalid.path/echo.api/x.pem",
      "https://s3.amazonaws.com/echo.api/../x.pem",
      "https://usuario@s3.amazonaws.com/echo.api/x.pem",
      "",
      null,
      "no es una url",
    ]) {
      expect(urlDeCertificadosValida(mala as string | null)).toBe(false);
    }
  });

  it("la fecha: menos de 150 segundos", () => {
    const ahora = new Date("2026-11-04T10:00:00Z");
    expect(fechaReciente("2026-11-04T09:58:00Z", ahora)).toBe(true);
    expect(fechaReciente("2026-11-04T09:57:00Z", ahora)).toBe(false);
    expect(fechaReciente("2026-11-04T10:03:00Z", ahora)).toBe(false);
    expect(fechaReciente("ayer", ahora)).toBe(false);
    expect(fechaReciente(undefined, ahora)).toBe(false);
  });
});

describe("alexa: la firma", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const ahora = new Date("2026-11-04T10:00:00Z");
  const cuerpo = JSON.stringify({ request: { timestamp: "2026-11-04T10:00:00Z" } });
  const firmar = (texto: string) =>
    createSign("RSA-SHA256").update(texto).sign(privateKey, "base64");
  const cert = (extra: Partial<Certificado> = {}): Certificado => ({
    clavePublica: publicKey,
    nombres: ["echo-api.amazon.com"],
    desde: new Date("2026-01-01T00:00:00Z"),
    hasta: new Date("2027-01-01T00:00:00Z"),
    ...extra,
  });
  const base = {
    cuerpo,
    firma: firmar(cuerpo),
    urlCertificados: "https://s3.amazonaws.com/echo.api/c.pem",
    timestamp: "2026-11-04T10:00:00Z",
    ahora,
    obtenerCertificado: async () => cert(),
  };

  it("la buena pasa", async () => {
    expect(await peticionDeAlexa(base)).toBe(true);
  });

  it("todo lo que falle, fuera", async () => {
    expect(await peticionDeAlexa({ ...base, cuerpo: cuerpo + " " })).toBe(false); // cuerpo cambiado
    expect(await peticionDeAlexa({ ...base, firma: null })).toBe(false);
    expect(await peticionDeAlexa({ ...base, firma: "AAAA" })).toBe(false);
    expect(
      await peticionDeAlexa({ ...base, urlCertificados: "https://evil.com/echo.api/c.pem" }),
    ).toBe(false);
    expect(await peticionDeAlexa({ ...base, timestamp: "2026-11-04T09:00:00Z" })).toBe(false);
    expect(await peticionDeAlexa({ ...base, obtenerCertificado: async () => null })).toBe(false);
    expect(
      await peticionDeAlexa({
        ...base,
        obtenerCertificado: async () => {
          throw new Error("sin red");
        },
      }),
    ).toBe(false);
    // Certificado caducado, aún no vigente o de otro nombre.
    expect(
      await peticionDeAlexa({
        ...base,
        obtenerCertificado: async () => cert({ hasta: new Date("2026-06-01") }),
      }),
    ).toBe(false);
    expect(
      await peticionDeAlexa({
        ...base,
        obtenerCertificado: async () => cert({ desde: new Date("2026-12-01") }),
      }),
    ).toBe(false);
    expect(
      await peticionDeAlexa({
        ...base,
        obtenerCertificado: async () => cert({ nombres: ["otro.com"] }),
      }),
    ).toBe(false);
    // Firmado con otra clave.
    const otra = generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(
      await peticionDeAlexa({
        ...base,
        obtenerCertificado: async () => cert({ clavePublica: otra.publicKey }),
      }),
    ).toBe(false);
  });
});

describe("alexa: la cadena de certificados", () => {
  // Un certificado real de Amazon de 2019 (público): vale solo en su época.
  const pem = readFileSync(new URL("./pruebas/alexa-cadena-2019.pem", import.meta.url), "utf8");
  const cadena = (
    pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []
  ).map((p) => new X509Certificate(p));

  it("llega a una raíz de confianza mientras está vigente", () => {
    expect(cadena).toHaveLength(4);
    expect(cadenaDeConfianza(cadena, new Date("2019-12-01T00:00:00Z"))).toBe(true);
  });

  it("caducada o incompleta, no", () => {
    expect(cadenaDeConfianza(cadena, new Date("2026-11-04T00:00:00Z"))).toBe(false);
    expect(cadenaDeConfianza(cadena.slice(0, 1), new Date("2019-12-01T00:00:00Z"))).toBe(false);
    expect(cadenaDeConfianza([], new Date("2019-12-01T00:00:00Z"))).toBe(false);
    // Un certificado cualquiera que no encadena con el de Amazon.
    expect(
      cadenaDeConfianza(
        [cadena[0] as X509Certificate, cadena[2] as X509Certificate],
        new Date("2019-12-01T00:00:00Z"),
      ),
    ).toBe(false);
  });
});
