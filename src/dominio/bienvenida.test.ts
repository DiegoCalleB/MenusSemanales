import { describe, expect, it } from "vitest";
import { BIENVENIDA_ANA_VECES, tocaBienvenidaAna } from "./bienvenida";

const base = { nombre: "Ana", hoy: "2026-11-06", vistas: 0 };

describe("tocaBienvenidaAna", () => {
  it("sale a Ana desde el 6 de noviembre", () => {
    expect(tocaBienvenidaAna(base)).toBe(true);
  });
  it("no sale antes del 6", () => {
    expect(tocaBienvenidaAna({ ...base, hoy: "2026-11-05" })).toBe(false);
  });
  it("sigue saliendo los días siguientes hasta las veces previstas", () => {
    expect(
      tocaBienvenidaAna({ ...base, hoy: "2026-12-01", vistas: BIENVENIDA_ANA_VECES - 1 }),
    ).toBe(true);
    expect(tocaBienvenidaAna({ ...base, vistas: BIENVENIDA_ANA_VECES })).toBe(false);
  });
  it("no sale a nadie más ni sin perfil", () => {
    expect(tocaBienvenidaAna({ ...base, nombre: "Diego" })).toBe(false);
    expect(tocaBienvenidaAna({ ...base, nombre: null })).toBe(false);
  });
  it("reconoce el nombre con mayúsculas, espacios y sin tildes", () => {
    expect(tocaBienvenidaAna({ ...base, nombre: " ANA " })).toBe(true);
    expect(tocaBienvenidaAna({ ...base, nombre: "Aná" })).toBe(true);
  });
});
