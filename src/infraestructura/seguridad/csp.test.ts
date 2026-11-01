import { describe, expect, it } from "vitest";
import { construirCsp, generarNonce } from "./csp";

const nonce = "AbCdEfGhIjKlMnOpQrStUv==";
const directiva = (csp: string, nombre: string) =>
  csp.split("; ").find((d) => d.startsWith(`${nombre} `)) ?? "";

describe("construirCsp", () => {
  const prod = construirCsp({
    nonce,
    supabaseUrl: "https://abc.supabase.co",
    esDesarrollo: false,
  });

  it("solo permite scripts con el nonce de la petición", () => {
    const scripts = directiva(prod, "script-src");
    expect(scripts).toContain(`'nonce-${nonce}'`);
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("no permite estilos inline sin nonce", () => {
    expect(directiva(prod, "style-src")).not.toContain("'unsafe-inline'");
  });

  it("limita las conexiones a la app y a Supabase (HTTPS y WebSocket seguro)", () => {
    expect(directiva(prod, "connect-src")).toBe(
      "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co",
    );
  });

  it("impide incrustar la app en iframes y los plugins", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
  });

  it("fuerza HTTPS en producción", () => {
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("en desarrollo permite unsafe-eval (depuración de React) y no fuerza HTTPS", () => {
    const dev = construirCsp({ nonce, supabaseUrl: "http://127.0.0.1:54321", esDesarrollo: true });
    expect(directiva(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directiva(dev, "connect-src")).toContain("ws://127.0.0.1:54321");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("sin URL de Supabase, solo permite conexiones a la propia app", () => {
    const csp = construirCsp({ nonce, esDesarrollo: false });
    expect(directiva(csp, "connect-src")).toBe("connect-src 'self'");
  });

  it("rechaza Supabase sin HTTPS en producción", () => {
    expect(() =>
      construirCsp({ nonce, supabaseUrl: "http://abc.supabase.co", esDesarrollo: false }),
    ).toThrow(/HTTPS/);
  });

  it("rechaza nonces vacíos o con caracteres que romperían la cabecera", () => {
    expect(() => construirCsp({ nonce: "", esDesarrollo: false })).toThrow(/Nonce/);
    expect(() => construirCsp({ nonce: "abc'; script-src *", esDesarrollo: false })).toThrow(
      /Nonce/,
    );
  });
});

describe("generarNonce", () => {
  it("genera valores distintos y válidos en cada llamada", () => {
    const a = generarNonce();
    const b = generarNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/=]{24}$/);
    expect(() => construirCsp({ nonce: a, esDesarrollo: false })).not.toThrow();
  });
});
