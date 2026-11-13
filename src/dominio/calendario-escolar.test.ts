import { describe, expect, it } from "vitest";
import {
  CURSO_MADRID_2026_27,
  type AjusteCole,
  diaDeCole,
  diaOficial,
  hayCole,
  tramosSinCole,
} from "./calendario-escolar";
import { diaSemanaIso, sumarDias } from "./fechas";

/**
 * El calendario escolar de Madrid capital 2026/2027 (D-144), comprobado contra la Orden 2034/2026
 * (BOCM 4-6-2026) y el Decreto 82/2026 (BOCM 1-10-2026). Si algo de aquí falla, el dato está mal.
 */
const C = CURSO_MADRID_2026_27;

/** Todos los días lectivos del curso, según el calendario. */
function lectivos(): string[] {
  const out: string[] = [];
  for (let f = C.inicio; f <= C.fin; f = sumarDias(f, 1)) if (hayCole(f, [])) out.push(f);
  return out;
}

describe("calendario escolar de Madrid 2026/2027", () => {
  it("empieza el lunes 7 de septiembre y acaba el viernes 18 de junio", () => {
    expect(diaSemanaIso(C.inicio)).toBe(1);
    expect(diaSemanaIso(C.fin)).toBe(5);
    expect(hayCole("2026-09-04", [])).toBe(false);
    expect(hayCole("2026-09-07", [])).toBe(true);
    expect(hayCole("2027-06-18", [])).toBe(true);
    expect(hayCole("2027-06-21", [])).toBe(false);
  });

  it("los días sin cole entre semana son exactamente los de la orden y el decreto", () => {
    const sinCole: string[] = [];
    for (let f = C.inicio; f <= C.fin; f = sumarDias(f, 1)) {
      if (diaSemanaIso(f) <= 5 && !hayCole(f, [])) sinCole.push(f);
    }
    expect(sinCole).toEqual([
      "2026-10-12",
      "2026-11-02",
      "2026-11-09",
      "2026-12-07",
      "2026-12-08",
      // Navidad: del 23 de diciembre al 6 de enero, ambos inclusive.
      "2026-12-23",
      "2026-12-24",
      "2026-12-25",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-04",
      "2027-01-05",
      "2027-01-06",
      // Otros días no lectivos.
      "2027-01-07",
      "2027-01-08",
      "2027-02-12",
      "2027-02-15",
      // San José, Semana Santa (20 al 28) y el 29 no lectivo.
      "2027-03-19",
      "2027-03-22",
      "2027-03-23",
      "2027-03-24",
      "2027-03-25",
      "2027-03-26",
      "2027-03-29",
    ]);
  });

  it("cumple el mínimo legal de 175 días lectivos", () => {
    expect(lectivos().length).toBeGreaterThanOrEqual(175);
  });

  it("los tramos están en orden, sin solaparse y dentro de lo que cubre", () => {
    let antes = "0000-00-00";
    for (const t of C.sinCole) {
      expect(t.desde <= t.hasta).toBe(true);
      expect(t.desde > antes).toBe(true);
      expect(t.desde >= C.cubreDesde && t.hasta <= C.cubreHasta).toBe(true);
      antes = t.hasta;
    }
  });

  it("dice el motivo, y el fin de semana nunca hay cole", () => {
    expect(diaOficial("2026-12-28")).toEqual({
      hay: false,
      motivo: "Vacaciones de Navidad",
      origen: "oficial",
    });
    expect(diaOficial("2026-11-14").origen).toBe("fin-de-semana");
    expect(diaOficial("2026-11-16")).toEqual({ hay: true, motivo: null, origen: "lectivo" });
  });

  it("sin calendario conocido, entre semana se supone que hay cole (mejor avisar de más)", () => {
    expect(diaOficial("2027-09-13")).toEqual({ hay: true, motivo: null, origen: "sin-datos" });
    expect(hayCole("2027-09-11", [])).toBe(false); // sábado
  });
});

describe("lo que apunta la familia", () => {
  const ajustes: AjusteCole[] = [
    { fecha: "2026-12-04", hay: false, motivo: "Día de libre disposición" },
    { fecha: "2027-02-12", hay: true, motivo: "" },
    { fecha: "2026-11-21", hay: true, motivo: "" }, // sábado: no cuenta
  ];

  it("manda sobre lo oficial en los dos sentidos, pero no sobre el fin de semana", () => {
    expect(diaDeCole("2026-12-04", ajustes)).toEqual({
      hay: false,
      motivo: "Día de libre disposición",
      origen: "familia",
    });
    expect(hayCole("2027-02-12", ajustes)).toBe(true);
    expect(hayCole("2026-11-21", ajustes)).toBe(false);
  });

  it("los tramos juntan días seguidos con el mismo motivo, saltando el fin de semana", () => {
    const t = tramosSinCole(ajustes, "2026-12-01", 45);
    expect(t).toEqual([
      {
        desde: "2026-12-04",
        hasta: "2026-12-04",
        motivo: "Día de libre disposición",
        origen: "familia",
      },
      {
        desde: "2026-12-07",
        hasta: "2026-12-07",
        motivo: "Día de la Constitución",
        origen: "oficial",
      },
      { desde: "2026-12-08", hasta: "2026-12-08", motivo: "La Inmaculada", origen: "oficial" },
      {
        desde: "2026-12-23",
        hasta: "2027-01-06",
        motivo: "Vacaciones de Navidad",
        origen: "oficial",
      },
      { desde: "2027-01-07", hasta: "2027-01-08", motivo: "Día no lectivo", origen: "oficial" },
    ]);
  });
});
