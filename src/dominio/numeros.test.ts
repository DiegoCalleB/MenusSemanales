import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { redondear, redondearArriba } from "./numeros";

describe("redondear", () => {
  it("redondea a dos decimales y absorbe el ruido de coma flotante", () => {
    expect(redondear(0.1 + 0.2)).toBe(0.3);
    expect(redondear(1.005)).toBe(1.01);
    expect(redondear(2.5, 0)).toBe(3);
  });
});

describe("redondearArriba", () => {
  it("sube al siguiente múltiplo del paso", () => {
    expect(redondearArriba(310, 50)).toBe(350);
    expect(redondearArriba(300, 50)).toBe(300);
    expect(redondearArriba(1, 1)).toBe(1);
    expect(redondearArriba(2.2, 1)).toBe(3);
  });

  it("no se deja engañar por la coma flotante (0,3 / 0,1 ≈ 2,9999…)", () => {
    expect(redondearArriba(0.3, 0.1)).toBe(0.3);
    expect(redondearArriba(0.7, 0.1)).toBe(0.7);
  });

  it("devuelve 0 para cantidades no positivas y rechaza pasos inválidos", () => {
    expect(redondearArriba(0, 50)).toBe(0);
    expect(redondearArriba(-5, 50)).toBe(0);
    expect(() => redondearArriba(10, 0)).toThrow(RangeError);
    expect(() => redondearArriba(10, Number.NaN)).toThrow(RangeError);
  });

  it("propiedad: el resultado es múltiplo del paso y nunca queda por debajo del valor", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.constantFrom(1, 50, 100), (v, paso) => {
        const r = redondearArriba(v, paso);
        expect(r).toBeGreaterThanOrEqual(v);
        expect(r - v).toBeLessThan(paso);
        expect(r % paso).toBe(0);
      }),
    );
  });
});
