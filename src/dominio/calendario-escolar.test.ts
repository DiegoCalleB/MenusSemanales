import { describe, expect, it } from "vitest";
import {
  CURSO_MADRID_2026_27,
  type AjusteCole,
  type CalendarioLeido,
  calendarioConocidoHasta,
  cursoDesdeLeido,
  diasLectivos,
  domingoDePascua,
  fiestasLocalesMadrid,
  registrarCursos,
  validarCurso,
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

describe("leer el calendario de cada curso (D-146)", () => {
  // Lo que diría la orden de 2026/2027 (y el cuadro con los festivos de 2027).
  const leido: CalendarioLeido = {
    inicio: "2026-09-07",
    fin: "2027-06-18",
    periodos: [
      { desde: "2026-12-23", hasta: "2027-01-06", motivo: "Vacaciones de Navidad" },
      { desde: "2027-03-20", hasta: "2027-03-28", motivo: "Semana Santa" },
    ],
    dias: [
      { fecha: "2026-10-12", motivo: "Fiesta Nacional de España" },
      { fecha: "2026-11-02", motivo: "Todos los Santos" },
      { fecha: "2026-12-07", motivo: "Día de la Constitución" },
      { fecha: "2026-12-08", motivo: "La Inmaculada" },
      { fecha: "2026-12-25", motivo: "Navidad" }, // dentro de las vacaciones: no se repite
      { fecha: "2027-01-07", motivo: "Día no lectivo" },
      { fecha: "2027-01-08", motivo: "Día no lectivo" },
      { fecha: "2027-02-12", motivo: "Día no lectivo" },
      { fecha: "2027-02-15", motivo: "Día no lectivo" },
      { fecha: "2027-03-19", motivo: "San José" },
      { fecha: "2027-03-29", motivo: "Día no lectivo" },
      { fecha: "2027-05-01", motivo: "Fiesta del Trabajo" },
    ],
  };

  it("la Pascua sale bien", () => {
    expect(domingoDePascua(2026)).toBe("2026-04-05");
    expect(domingoDePascua(2027)).toBe("2027-03-28");
    expect(domingoDePascua(2028)).toBe("2028-04-16");
    expect(domingoDePascua(2030)).toBe("2030-04-21");
  });

  it("montado desde lo leído, da los mismos días lectivos que el revisado a mano", () => {
    const c = cursoDesdeLeido(leido, "prueba");
    expect(validarCurso(c)).toEqual([]);
    expect(diasLectivos(c)).toEqual(diasLectivos(CURSO_MADRID_2026_27));
    expect(c.sinCole.filter((t) => t.desde === "2026-12-25")).toEqual([]);
  });

  it("el calendario revisado a mano pasa todas las comprobaciones", () => {
    expect(validarCurso(CURSO_MADRID_2026_27)).toEqual([]);
  });

  it("las fiestas de Madrid: en domingo pasan al lunes, en sábado no cuentan", () => {
    // 2027: Almudena martes 9 nov; San Isidro 2028 lunes 15 may.
    expect(fiestasLocalesMadrid(2027)).toEqual([
      { fecha: "2027-11-09", motivo: "La Almudena (fiesta local)" },
      { fecha: "2028-05-15", motivo: "San Isidro (fiesta local)" },
    ]);
    // 2025: Almudena domingo → lunes 10. 2026/27: San Isidro 2027 sábado → nada.
    expect(fiestasLocalesMadrid(2025)[0]?.fecha).toBe("2025-11-10");
    expect(fiestasLocalesMadrid(2026).map((f) => f.fecha)).toEqual(["2026-11-09"]);
  });

  it("rechaza lo que no cuadra: sin Navidad, sin Semana Santa, fechas raras o pocos días", () => {
    const mal = (cambio: Partial<CalendarioLeido>) =>
      validarCurso(cursoDesdeLeido({ ...leido, ...cambio }, "prueba"));
    expect(mal({ periodos: [leido.periodos[1]!] }).join()).toMatch(/Navidad/);
    expect(mal({ periodos: [leido.periodos[0]!] }).join()).toMatch(/Semana Santa/);
    expect(mal({ inicio: "2026-10-05" }).join()).toMatch(/septiembre/);
    expect(mal({ fin: "2027-07-20" }).join()).toMatch(/junio/);
    expect(mal({ inicio: "2026-09-05" }).join()).toMatch(/entre semana/); // sábado
    expect(mal({ dias: [] }).join()).toMatch(/12-08|10-12/);
    expect(mal({ fin: "2027-06-01" }).join()).toMatch(/días lectivos/);
    expect(mal({ inicio: "2026-02-30" })).toEqual(["Fechas de inicio o fin mal escritas."]);
  });

  it("los leídos se usan donde no hay revisado a mano, y nunca lo pisan", () => {
    const siguiente = cursoDesdeLeido(
      {
        inicio: "2027-09-08",
        fin: "2028-06-20",
        periodos: [
          { desde: "2027-12-23", hasta: "2028-01-07", motivo: "Vacaciones de Navidad" },
          { desde: "2028-04-08", hasta: "2028-04-16", motivo: "Semana Santa" },
        ],
        dias: [
          { fecha: "2027-10-12", motivo: "Fiesta Nacional" },
          { fecha: "2027-11-01", motivo: "Todos los Santos" },
          { fecha: "2027-12-06", motivo: "Constitución" },
          { fecha: "2027-12-08", motivo: "Inmaculada" },
        ],
      },
      "leído",
    );
    expect(validarCurso(siguiente)).toEqual([]);
    const pisaElDeAhora = { ...cursoDesdeLeido(leido, "leído"), sinCole: [] };
    try {
      registrarCursos([siguiente, pisaElDeAhora]);
      expect(diaOficial("2027-11-09").motivo).toBe("La Almudena (fiesta local)");
      expect(hayCole("2027-09-08", [])).toBe(true);
      expect(hayCole("2027-09-07", [])).toBe(false); // verano
      expect(diaOficial("2026-12-28").motivo).toBe("Vacaciones de Navidad");
      expect(calendarioConocidoHasta()).toBe("2028-08-31");
    } finally {
      registrarCursos([]);
    }
    expect(diaOficial("2027-11-09").origen).toBe("sin-datos");
  });
});
