import { describe, expect, it } from "vitest";
import { modoDe } from "./modo";

const personas = [
  { id: "nina", tipo: "nino", activa: true },
  { id: "diego", tipo: "adulto", activa: true },
  { id: "ana", tipo: "adulto", activa: true },
];

describe("modo familia o completo (D-206)", () => {
  it("sin elegir: completo para el primer adulto y familia para los demás", () => {
    expect(modoDe({}, personas, "diego")).toBe("completo");
    expect(modoDe({}, personas, "ana")).toBe("familia");
    expect(modoDe(undefined, personas, "nina")).toBe("familia");
    expect(modoDe({}, personas, null)).toBe("familia");
  });
  it("lo elegido manda", () => {
    expect(modoDe({ ana: "completo" }, personas, "ana")).toBe("completo");
    expect(modoDe({ diego: "familia" }, personas, "diego")).toBe("familia");
  });
});
