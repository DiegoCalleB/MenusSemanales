import { describe, expect, it } from "vitest";
import {
  type Cumple,
  avisosDeCumples,
  diasHasta,
  edadQueCumple,
  estadoVigente,
  fechaEnAnio,
  parsearCumples,
  parsearFecha,
  proximaFecha,
  urgenciaDe,
} from "./cumples";
import { ideasDeRegalo } from "./ideas-regalo";

const c = (extra: Partial<Cumple> = {}): Cumple => ({
  id: "c",
  nombre: "Alba",
  dia: 12,
  mes: 3,
  anio: 2017,
  relacion: "familia",
  ideas: [],
  estado: "sin-pensar",
  ...extra,
});

describe("fechas de cumpleaños", () => {
  it("la próxima fecha es este año si aún no ha pasado y el que viene si ya pasó; hoy cuenta", () => {
    expect(proximaFecha(c(), "2026-11-02")).toBe("2027-03-12");
    expect(proximaFecha(c({ dia: 7, mes: 11 }), "2026-11-02")).toBe("2026-11-07");
    expect(proximaFecha(c({ dia: 2, mes: 11 }), "2026-11-02")).toBe("2026-11-02");
    expect(diasHasta(c({ dia: 7, mes: 11 }), "2026-11-02")).toBe(5);
    expect(diasHasta(c({ dia: 2, mes: 11 }), "2026-11-02")).toBe(0);
  });

  it("el 29 de febrero cae el 28 en años no bisiestos", () => {
    expect(fechaEnAnio(2027, 2, 29)).toBe("2027-02-28");
    expect(fechaEnAnio(2028, 2, 29)).toBe("2028-02-29");
    expect(proximaFecha(c({ dia: 29, mes: 2 }), "2026-11-02")).toBe("2027-02-28");
  });

  it("la edad que cumple sale del año de nacimiento, si se sabe", () => {
    expect(edadQueCumple(c(), "2026-11-02")).toBe(10); // 12/3/2027 − 2017
    expect(edadQueCumple(c({ anio: null }), "2026-11-02")).toBeNull();
    expect(edadQueCumple(c({ dia: 7, mes: 11, anio: 1980 }), "2026-11-02")).toBe(46);
  });
});

describe("avisos con un mes de margen", () => {
  it.each([
    [0, "hoy"],
    [3, "esta-semana"],
    [7, "esta-semana"],
    [8, "comprar"],
    [14, "comprar"],
    [15, "pensar"],
    [30, "pensar"],
    [31, "lejos"],
  ])("a %i días: %s", (dias, urgencia) => expect(urgenciaDe(dias)).toBe(urgencia));

  it("solo avisa a menos de un mes, ordenado, y deja de avisar cuando el regalo está comprado", () => {
    const lista = [
      c({ id: "a", nombre: "Ana", dia: 7, mes: 11 }), // en 5 días
      c({ id: "b", nombre: "Emma", dia: 20, mes: 11 }), // en 18
      c({ id: "d", nombre: "Lejos", dia: 20, mes: 3 }),
      c({ id: "e", nombre: "Comprado", dia: 10, mes: 11, estado: "comprado", anioEstado: 2026 }),
    ];
    const avisos = avisosDeCumples(lista, "2026-11-02");
    expect(avisos.map((x) => [x.cumple.nombre, x.dias, x.urgencia])).toEqual([
      ["Ana", 5, "esta-semana"],
      ["Emma", 18, "pensar"],
    ]);
  });

  it("el propio día avisa aunque el regalo esté comprado, y el estado de otro año se reinicia", () => {
    const hoy = c({ dia: 2, mes: 11, estado: "comprado", anioEstado: 2026 });
    expect(avisosDeCumples([hoy], "2026-11-02")).toHaveLength(1);
    const viejo = c({ dia: 10, mes: 11, estado: "comprado", anioEstado: 2025 });
    expect(estadoVigente(viejo, "2026-11-02")).toBe("sin-pensar");
    expect(avisosDeCumples([viejo], "2026-11-02")).toHaveLength(1);
  });
});

describe("leer fechas a mano", () => {
  it.each([
    ["12/3", { dia: 12, mes: 3, anio: null }],
    ["12/03/2017", { dia: 12, mes: 3, anio: 2017 }],
    ["5-9-20", { dia: 5, mes: 9, anio: 2020 }],
    ["5 de septiembre de 2020", { dia: 5, mes: 9, anio: 2020 }],
    ["7 de noviembre", { dia: 7, mes: 11, anio: null }],
  ])("%s", (texto, esperado) => expect(parsearFecha(texto)).toEqual(esperado));

  it.each(["", "31/4", "30/2", "0/5", "12/13", "hola", "12/3/1800"])("rechaza %j", (t) =>
    expect(parsearFecha(t)).toBeNull(),
  );

  it("lee varias personas de una vez y señala lo que no entiende", () => {
    const r = parsearCumples(
      "Alba 12/3/2017, Emma 5/9/2020\nAbuela Rosa: 20 de enero\nPapá Noel pronto\nMarta 31/2",
    );
    expect(r.validos.map((v) => [v.nombre, v.dia, v.mes, v.anio])).toEqual([
      ["Alba", 12, 3, 2017],
      ["Emma", 5, 9, 2020],
      ["Abuela Rosa", 20, 1, null],
    ]);
    expect(r.erroneos).toEqual(["Papá Noel pronto", "Marta 31/2"]);
  });
});

describe("ideas de regalo", () => {
  it("empieza por los gustos y sigue con la edad", () => {
    const i = ideasDeRegalo({
      edad: 5,
      relacion: "familia",
      gustos: ["manualidades", " gatos ", ""],
    });
    expect(i.slice(0, 2)).toEqual(["Algo de manualidades", "Algo de gatos"]);
    expect(i.length).toBeLessThanOrEqual(8);
    expect(new Set(i).size).toBe(i.length);
    expect(i.join(" ")).toContain("Puzle");
  });
  it("un amigo del cole recibe ideas de regalo pequeño, y sin edad se asume adulto", () => {
    expect(ideasDeRegalo({ edad: 7, relacion: "cole" }).join(" ")).toContain("pequeño");
    expect(ideasDeRegalo({ edad: null, relacion: "familia" }).join(" ")).toContain("experiencia");
    expect(ideasDeRegalo({ edad: 1, relacion: "familia" })[0]).toContain("apilar");
    expect(ideasDeRegalo({ edad: 15, relacion: "familia" }).length).toBeGreaterThan(0);
  });
});
