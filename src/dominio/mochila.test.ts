import { describe, expect, it } from "vitest";
import {
  type CosaQueLlevar,
  cuandoSeLleva,
  cuandoSePrepara,
  paraLlevar,
  paraPreparar,
  preparacionesEntre,
} from "./mochila";
import { consultaCole } from "./calendario-escolar";

const cosa = (c: Partial<CosaQueLlevar>): CosaQueLlevar => ({
  id: "x",
  personaId: "alba",
  texto: "Algo",
  dias: [],
  fecha: null,
  antes: 1,
  preparadas: [],
  soloConCole: true,
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

describe("qué llevar y el calendario escolar (D-144)", () => {
  const conCole = consultaCole([]);
  // 2026-12-08 (martes) es la Inmaculada; 2027-02-12 (viernes), día no lectivo.

  it("lo del cole no toca el día que no hay cole, ni se prepara la víspera", () => {
    expect(paraLlevar([piano], "2026-12-08", conCole)).toEqual([]);
    expect(paraPreparar([piano], "2026-12-07", conCole)).toEqual([]);
    expect(paraPreparar([patines], "2027-02-11", conCole)).toEqual([]);
    // El martes siguiente, sí.
    expect(paraPreparar([piano], "2026-12-14", conCole).map((p) => p.para)).toEqual(["2026-12-15"]);
  });

  it("lo que no es del cole se lleva igual, y los días sueltos siempre", () => {
    const fuera = { ...piano, soloConCole: false };
    expect(paraLlevar([fuera], "2026-12-08", conCole)).toHaveLength(1);
    const suelto = cosa({ fecha: "2026-12-08", antes: 1 });
    expect(paraPreparar([suelto], "2026-12-07", conCole)).toHaveLength(1);
  });

  it("los días que apunta la familia cuentan, en los dos sentidos", () => {
    const libre = consultaCole([{ fecha: "2026-11-24", hay: false, motivo: "Libre disposición" }]);
    expect(paraPreparar([piano], "2026-11-23", libre)).toEqual([]);
    const siHay = consultaCole([{ fecha: "2026-12-08", hay: true, motivo: "" }]);
    expect(paraLlevar([piano], "2026-12-08", siHay)).toHaveLength(1);
  });

  it("un documento antiguo sin el campo cuenta como del cole", () => {
    const viejo = { ...piano } as Partial<CosaQueLlevar>;
    delete viejo.soloConCole;
    expect(paraLlevar([viejo as CosaQueLlevar], "2026-12-08", conCole)).toEqual([]);
  });

  it("los recordatorios de dos meses se saltan las Navidades", () => {
    const dias = preparacionesEntre([piano, patines], "2026-12-14", 30, conCole).map((p) => p.para);
    // El 22 de diciembre (martes) aún hay cole; las vacaciones empiezan el 23.
    expect(dias).toEqual(["2026-12-15", "2026-12-18", "2026-12-22", "2027-01-12"]);
  });
});
