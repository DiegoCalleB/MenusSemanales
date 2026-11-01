import { describe, expect, it } from "vitest";
import { diaSemanaIso, enRango, semanaDe, sumarDias } from "./fechas";

describe("fechas", () => {
  it("suma días cruzando mes y año", () => {
    expect(sumarDias("2026-01-31", 1)).toBe("2026-02-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29"); // año bisiesto
  });

  it("el día de la semana es ISO: lunes 1 ... domingo 7", () => {
    expect(diaSemanaIso("2026-11-02")).toBe(1); // lunes
    expect(diaSemanaIso("2026-11-08")).toBe(7); // domingo
  });

  it("la semana va de lunes a domingo, también si la fecha es domingo", () => {
    expect(semanaDe("2026-11-04")).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
    expect(semanaDe("2026-11-02")).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
    expect(semanaDe("2026-11-08")).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
  });

  it("comprueba rangos con los extremos incluidos", () => {
    expect(enRango("2026-11-02", "2026-11-02", "2026-11-08")).toBe(true);
    expect(enRango("2026-11-08", "2026-11-02", "2026-11-08")).toBe(true);
    expect(enRango("2026-11-09", "2026-11-02", "2026-11-08")).toBe(false);
  });

  it("rechaza fechas mal formadas o inexistentes", () => {
    expect(() => sumarDias("02/11/2026", 1)).toThrow(RangeError);
    expect(() => sumarDias("2026-02-30", 1)).toThrow(/no válida/);
    expect(() => sumarDias("2026-13-01", 1)).toThrow(RangeError);
  });
});
