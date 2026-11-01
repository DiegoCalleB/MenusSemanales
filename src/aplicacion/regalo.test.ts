import { describe, expect, it } from "vitest";
import { codificarRegalo, decodificarRegalo, enlaceDeRegalo } from "./regalo";

const regalo = { p: "Ana", d: "Diego", m: "Feliz cumple 🎂\nEsto es para ti: ¡ñandú, acción!" };

describe("regalo en un enlace", () => {
  it("ida y vuelta con tildes, emojis y saltos de línea", () => {
    expect(decodificarRegalo(codificarRegalo(regalo))).toEqual(regalo);
  });

  it("usa base64url: sin +, / ni =", () => {
    expect(codificarRegalo(regalo)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("acepta el fragmento completo y construye el enlace", () => {
    const enlace = enlaceDeRegalo("https://ejemplo.test", regalo);
    expect(enlace.startsWith("https://ejemplo.test/regalo#p=")).toBe(true);
    expect(decodificarRegalo(enlace.slice(enlace.indexOf("#")))).toEqual(regalo);
  });

  it("quita caracteres de control y respeta los límites", () => {
    const sucio = codificarRegalo({ p: "A\u0000na", d: "Diego", m: "hola\u0007" });
    expect(decodificarRegalo(sucio)).toEqual({ p: "Ana", d: "Diego", m: "hola" });
    expect(() => codificarRegalo({ p: "", d: "Diego", m: "x" })).toThrow();
    expect(() => codificarRegalo({ p: "Ana", d: "Diego", m: "x".repeat(601) })).toThrow();
  });

  it("rechaza fragmentos inválidos, manipulados o demasiado largos (nunca lanza)", () => {
    for (const malo of ["", "#", "#p=", "no es base64!", "@@@@", "x".repeat(4001), "e30"]) {
      expect(decodificarRegalo(malo)).toBeNull();
    }
    // JSON válido pero con otra forma o con HTML: se valida o se muestra como texto, nunca se interpreta.
    const otro = btoa(JSON.stringify({ p: 1 })).replace(/=+$/, "");
    expect(decodificarRegalo(otro)).toBeNull();
    const html = codificarRegalo({
      p: "<img src=x onerror=alert(1)>",
      d: "D",
      m: "<script>x</script>",
    });
    expect(decodificarRegalo(html)?.p).toBe("<img src=x onerror=alert(1)>"); // texto literal; React lo escapa
  });
});
