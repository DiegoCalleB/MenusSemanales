import { describe, expect, it } from "vitest";
import { ESPACIO_LEGADO, esUuid, idDeLegado, idDerivado, uuidV5 } from "./identificadores";

const NS_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("uuidV5", () => {
  it("coincide con los vectores conocidos de la RFC", () => {
    expect(uuidV5("python.org", NS_DNS)).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
    expect(uuidV5("www.example.com", NS_DNS)).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("funciona con nombres largos (más de un bloque de SHA-1) y con acentos", () => {
    const largo = "ñ".repeat(200);
    const a = uuidV5(largo, NS_DNS);
    expect(esUuid(a)).toBe(true);
    expect(uuidV5(largo, NS_DNS)).toBe(a);
    expect(uuidV5(largo + "a", NS_DNS)).not.toBe(a);
  });

  it("rechaza un espacio de nombres que no sea UUID", () => {
    expect(() => uuidV5("x", "no-es-uuid")).toThrow();
  });
});

describe("ids derivados", () => {
  const base = "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11";

  it("son deterministas, distintos por clave y UUID válidos", () => {
    expect(idDerivado(base, "0")).toBe(idDerivado(base, "0"));
    expect(idDerivado(base, "0")).not.toBe(idDerivado(base, "1"));
    expect(esUuid(idDerivado(base, "agenda:0"))).toBe(true);
  });

  it("dos bases distintas no chocan con la misma clave", () => {
    expect(idDerivado(base, "0")).not.toBe(idDerivado("1c2c1d2f-9a5f-4b5f-8d1f-3a1a8c7a1b22", "0"));
  });

  it("el id de un dato antiguo es estable por hogar", () => {
    const hogar = "5f3d4e1a-6b7c-4d8e-9f0a-1b2c3d4e5f60";
    expect(idDeLegado(hogar, "c-3")).toBe(idDeLegado(hogar, "c-3"));
    expect(idDeLegado(hogar, "c-3")).not.toBe(idDeLegado(hogar, "c-4"));
    expect(idDeLegado(hogar, "c-3")).not.toBe(idDeLegado(base, "c-3"));
    expect(esUuid(ESPACIO_LEGADO)).toBe(true);
  });
});

describe("esUuid", () => {
  it("distingue UUID de ids antiguos", () => {
    expect(esUuid("c-3")).toBe(false);
    expect(esUuid("")).toBe(false);
    expect(esUuid("0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11")).toBe(true);
  });
});
