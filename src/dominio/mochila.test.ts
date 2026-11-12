import { describe, expect, it } from "vitest";
import {
  type CosaQueLlevar,
  cuandoSeLleva,
  cuandoSePrepara,
  paraLlevar,
  paraPreparar,
  preparacionesEntre,
} from "./mochila";

const cosa = (c: Partial<CosaQueLlevar>): CosaQueLlevar => ({
  id: "x",
  personaId: "alba",
  texto: "Algo",
  dias: [],
  fecha: null,
  antes: 1,
  preparadas: [],
  ...c,
});

// 2026-11-17 es martes; 2026-11-19, jueves; 2026-11-20, viernes.
const piano = cosa({ id: "piano", texto: "Carpeta de piano", dias: [2] });
const patines = cosa({ id: "patines", personaId: "emma", texto: "Patines", dias: [5] });
const excursion = cosa({ id: "exc", texto: "Autorización", fecha: "2026-11-25", antes: 2 });

describe("qué llevar (D-136)", () => {
  it("sabe qué se lleva cada día", () => {
    expect(paraLlevar([piano, patines], "2026-11-17").map((c) => c.id)).toEqual(["piano"]);
    expect(paraLlevar([piano, patines], "2026-11-20").map((c) => c.id)).toEqual(["patines"]);
    expect(paraLlevar([piano, patines], "2026-11-18")).toEqual([]);
  });

  it("los patines del viernes se preparan el jueves; el piano del martes, el lunes", () => {
    expect(paraPreparar([piano, patines], "2026-11-19")).toEqual([
      { cosa: patines, para: "2026-11-20", hecho: false },
    ]);
    expect(paraPreparar([piano, patines], "2026-11-16").map((p) => p.cosa.id)).toEqual(["piano"]);
    expect(paraPreparar([piano, patines], "2026-11-20")).toEqual([]);
  });

  it("un día suelto con dos días de antelación, y lo ya preparado se marca", () => {
    expect(paraPreparar([excursion], "2026-11-23")).toEqual([
      { cosa: excursion, para: "2026-11-25", hecho: false },
    ]);
    const hecha = { ...patines, preparadas: ["2026-11-20"] };
    expect(paraPreparar([hecha], "2026-11-19")[0]?.hecho).toBe(true);
  });

  it("lista las preparaciones de una semana", () => {
    const semana = preparacionesEntre([piano, patines], "2026-11-16", 7);
    expect(semana.map((p) => `${p.dia}:${p.cosa.id}`)).toEqual([
      "2026-11-16:piano",
      "2026-11-19:patines",
    ]);
  });

  it("lo dice en castellano", () => {
    expect(cuandoSeLleva(piano)).toBe("los martes");
    expect(cuandoSeLleva(cosa({ dias: [4, 1] }))).toBe("los lunes y jueves");
    expect(cuandoSeLleva(cosa({ dias: [6, 7] }))).toBe("los sábados y domingos");
    expect(cuandoSeLleva(excursion)).toBe("el miércoles 25");
    expect(cuandoSePrepara(1)).toBe("la víspera");
    expect(cuandoSePrepara(0)).toBe("el mismo día");
    expect(cuandoSePrepara(3)).toBe("3 días antes");
  });
});
