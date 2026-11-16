import { describe, expect, it } from "vitest";
import {
  type Medicamento,
  faltaTomar,
  horaTexto,
  medicacionesDeLaHora,
  podarTomadas,
  resumenDeDias,
  tocaTomar,
} from "./medicacion";

const pastilla: Medicamento = {
  id: "m1",
  personaId: "diego",
  nombre: "Pastilla",
  hora: 21,
  dias: [1, 2, 3, 4, 5],
  tomadas: [],
};

describe("medicación (D-166)", () => {
  it("toca de lunes a viernes, no el fin de semana", () => {
    expect(tocaTomar(pastilla, "2026-11-16")).toBe(true); // lunes
    expect(tocaTomar(pastilla, "2026-11-20")).toBe(true); // viernes
    expect(tocaTomar(pastilla, "2026-11-21")).toBe(false); // sábado
    expect(tocaTomar(pastilla, "2026-11-22")).toBe(false); // domingo
  });

  it("a las 21:00 de un día que toca, se recuerda; a otra hora o ya tomada, no", () => {
    expect(medicacionesDeLaHora([pastilla], "2026-11-16", 21)).toEqual([pastilla]);
    expect(medicacionesDeLaHora([pastilla], "2026-11-16", 20)).toEqual([]);
    expect(medicacionesDeLaHora([pastilla], "2026-11-21", 21)).toEqual([]);
    const tomada = { ...pastilla, tomadas: ["2026-11-16"] };
    expect(faltaTomar(tomada, "2026-11-16")).toBe(false);
    expect(medicacionesDeLaHora([tomada], "2026-11-16", 21)).toEqual([]);
    // Lo tomado ayer no cuenta hoy.
    expect(
      medicacionesDeLaHora([{ ...pastilla, tomadas: ["2026-11-15"] }], "2026-11-16", 21),
    ).toHaveLength(1);
  });

  it("solo guarda las marcas de los últimos 14 días", () => {
    const m = { ...pastilla, tomadas: ["2026-10-01", "2026-11-10", "2026-11-16"] };
    expect(podarTomadas(m, "2026-11-16").tomadas).toEqual(["2026-11-10", "2026-11-16"]);
    expect(podarTomadas(pastilla, "2026-11-16")).toBe(pastilla);
  });

  it("la hora y los días, dichos claro", () => {
    expect(horaTexto(21)).toBe("21:00");
    expect(horaTexto(7)).toBe("07:00");
    expect(resumenDeDias([1, 2, 3, 4, 5])).toBe("de lunes a viernes");
    expect(resumenDeDias([1, 2, 3, 4, 5, 6, 7])).toBe("todos los días");
    expect(resumenDeDias([6, 7])).toBe("los fines de semana");
    expect(resumenDeDias([1, 3, 5])).toBe("lun, mié y vie");
    expect(resumenDeDias([2])).toBe("mar");
  });
});
