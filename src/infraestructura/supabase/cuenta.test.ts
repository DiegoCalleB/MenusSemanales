import { describe, expect, it } from "vitest";
import { mensajeDeError } from "./cuenta";

describe("mensajeDeError", () => {
  it("explica la contraseña incorrecta y sugiere el código", () => {
    expect(mensajeDeError({ message: "Invalid login credentials" })).toMatch(/contraseña/);
  });
  it("explica que una contraseña débil necesita más caracteres", () => {
    expect(mensajeDeError({ message: "Password should be at least 6 characters" })).toMatch(
      /10 caracteres/,
    );
  });
  it("explica el tope de correos", () => {
    expect(mensajeDeError({ message: "email rate limit exceeded" })).toMatch(/espera/);
  });
  it("no enseña mensajes técnicos que no conoce", () => {
    expect(mensajeDeError({ message: "boom: stack trace" })).toBe(
      "No se ha podido completar. Inténtalo de nuevo.",
    );
  });
});
