import { describe, expect, it } from "vitest";
import { parsearEnvPublico } from "./env";

const validas = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ejemplo.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
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
