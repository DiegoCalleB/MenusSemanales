import { describe, expect, it } from "vitest";
import { diagnosticarEnvPublico, parsearEnvPublico } from "./env";

const validas = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ejemplo.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxx",
};

describe("parsearEnvPublico", () => {
  it("acepta una configuración válida", () => {
    expect(parsearEnvPublico(validas)).toEqual(validas);
  });

  it("explica qué variable falta", () => {
    expect(() => parsearEnvPublico({ ...validas, NEXT_PUBLIC_SUPABASE_URL: undefined })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("rechaza una URL mal formada", () => {
    expect(() => parsearEnvPublico({ ...validas, NEXT_PUBLIC_SUPABASE_URL: "no-es-url" })).toThrow(
      /URL válida/,
    );
  });

  it("rechaza una clave secreta en el lugar de la publishable", () => {
    // Protege contra el error grave de exponer la clave secreta en el navegador.
    expect(() =>
      parsearEnvPublico({ ...validas, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_xyz" }),
    ).toThrow(/publishable/);
  });
});

describe("diagnosticarEnvPublico", () => {
  const url = "https://ejemplo.supabase.co";
  it("distingue lo que falta de lo que está mal puesto, sin devolver los valores", () => {
    expect(diagnosticarEnvPublico({ url, clave: "sb_publishable_abc" })).toBe("ok");
    expect(diagnosticarEnvPublico({ url: undefined, clave: undefined })).toBe("ausente");
    expect(diagnosticarEnvPublico({ url: "", clave: "" })).toBe("ausente");
    expect(diagnosticarEnvPublico({ url: "no-es-url", clave: "sb_publishable_abc" })).toBe(
      "url-invalida",
    );
    expect(diagnosticarEnvPublico({ url, clave: undefined })).toBe("clave-invalida");
    // La clave antigua (JWT) y la secreta no valen como publishable.
    expect(diagnosticarEnvPublico({ url, clave: "eyJhbGciOiJIUzI1NiJ9.x.y" })).toBe(
      "clave-invalida",
    );
    expect(diagnosticarEnvPublico({ url, clave: "sb_secret_abc" })).toBe("clave-invalida");
  });
});
