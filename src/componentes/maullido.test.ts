import { describe, expect, it } from "vitest";
import { MAULLIDOS, elegirMaullido } from "./maullido";

describe("elegirMaullido", () => {
  it("nunca repite el último si hay más de uno", () => {
    for (const ultimo of MAULLIDOS) {
      for (const azar of [0, 0.34, 0.67, 0.999]) {
        expect(elegirMaullido(MAULLIDOS, ultimo, () => azar)).not.toBe(ultimo);
      }
    }
  });
  it("con uno solo, ese", () => {
    expect(elegirMaullido(["/a.mp3"], "/a.mp3")).toBe("/a.mp3");
  });
  it("sin último elige cualquiera de la lista", () => {
    expect(MAULLIDOS).toContain(elegirMaullido(MAULLIDOS, null, () => 0.5));
  });
});
