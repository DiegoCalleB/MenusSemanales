import { describe, expect, it } from "vitest";
import {
  PLANTILLAS,
  PLANTILLA_CASA,
  PLANTILLA_GATOS,
  type TareaCasa,
  aplazarUnDia,
  diasParaCasa,
  estadoDeCasa,
  marcarHecha,
  ordenadasPorFecha,
  proximaVez,
  quePideHoy,
  repartirEntre,
  textoFrecuencia,
} from "./casa";

const HOY = "2026-11-02";
const t = (extra: Partial<TareaCasa> = {}): TareaCasa => ({
  id: "a",
  titulo: "Sábanas",
  emoji: "🛏️",
  cadaDias: 14,
  responsableId: null,
  ultimaVez: null,
  desde: HOY,
  ...extra,
});

describe("cuándo toca", () => {
  it("nunca hecha: toca desde su primer día; hecha: contando desde la última vez", () => {
    expect(proximaVez(t({ desde: "2026-11-05" }))).toBe("2026-11-05");
    expect(proximaVez(t({ ultimaVez: "2026-10-25" }))).toBe("2026-11-08");
    expect(diasParaCasa(t({ ultimaVez: "2026-10-25" }), HOY)).toBe(6);
  });

  it.each([
    ["2026-10-18", "atrasada"], // tocaba el 1 de noviembre
    ["2026-10-19", "hoy"],
    ["2026-10-20", "pronto"],
    ["2026-10-26", "pronto"], // en 7 días: el límite
    ["2026-10-27", "lejos"], // en 8
  ])("con 14 días, hecha el %s → %s", (ultima, esperado) => {
    expect(estadoDeCasa(t({ ultimaVez: ultima }), HOY)).toBe(esperado);
  });

  it("el margen de «pronto» se puede cambiar", () => {
    expect(estadoDeCasa(t({ desde: "2026-11-09" }), HOY)).toBe("pronto");
    expect(estadoDeCasa(t({ desde: "2026-11-10" }), HOY)).toBe("lejos");
    expect(estadoDeCasa(t({ desde: "2026-11-05" }), HOY, 2)).toBe("lejos");
  });
});

describe("marcar hecha y aplazar", () => {
  it("hecha hoy se reprograma desde hoy y quita el aplazamiento", () => {
    const hecha = marcarHecha(t({ aplazadaHasta: "2026-11-03" }), HOY);
    expect(hecha.ultimaVez).toBe(HOY);
    expect(hecha.aplazadaHasta).toBeNull();
    expect(proximaVez(hecha)).toBe("2026-11-16");
  });
  it("«mañana» la aparta un día sin cambiar cuándo se hizo", () => {
    const x = aplazarUnDia(t({ ultimaVez: "2026-10-01" }), HOY);
    expect(proximaVez(x)).toBe("2026-11-03");
    expect(x.ultimaVez).toBe("2026-10-01");
    // Un aplazamiento anterior a la fecha natural no la adelanta.
    expect(proximaVez(t({ desde: "2026-11-20", aplazadaHasta: "2026-11-03" }))).toBe("2026-11-20");
  });
});

describe("qué toca hoy", () => {
  it("las vencidas y las de hoy, las más atrasadas primero; ordena todas por fecha", () => {
    const lista = [
      t({ id: "1", titulo: "B", desde: "2026-11-02" }),
      t({ id: "2", titulo: "A", desde: "2026-10-20" }),
      t({ id: "3", titulo: "C", desde: "2026-11-09" }),
    ];
    expect(quePideHoy(lista, HOY).map((x) => x.id)).toEqual(["2", "1"]);
    expect(ordenadasPorFecha(lista, HOY).map((x) => x.id)).toEqual(["2", "1", "3"]);
  });
});

describe("texto y plantilla", () => {
  it.each([
    [1, "cada día"],
    [7, "cada semana"],
    [14, "cada 2 semanas"],
    [21, "cada 3 semanas"],
    [30, "cada mes"],
    [90, "cada 3 meses"],
    [180, "cada 6 meses"],
    [365, "cada año"],
    [10, "cada 10 días"],
    [70, "cada 70 días"],
  ])("%i días: %s", (d, texto) => expect(textoFrecuencia(d)).toBe(texto));

  it("la plantilla incluye sábanas y toallas, sin títulos repetidos y escalonada", () => {
    const titulos = PLANTILLA_CASA.map((p) => p.titulo);
    expect(new Set(titulos).size).toBe(titulos.length);
    expect(titulos.join(" ")).toMatch(/sábanas/i);
    expect(titulos.join(" ")).toMatch(/toallas/i);
    expect(PLANTILLA_CASA.filter((p) => p.empiezaEn === 0).length).toBeLessThanOrEqual(2);
  });
});

describe("repartir entre los adultos", () => {
  it("alterna, respeta lo ya asignado y tiene en cuenta quién lleva menos", () => {
    const lista = [
      t({ id: "1", responsableId: "diego" }),
      t({ id: "2" }),
      t({ id: "3" }),
      t({ id: "4" }),
    ];
    expect(repartirEntre(lista, ["diego", "ana"]).map((x) => x.responsableId)).toEqual([
      "diego",
      "ana",
      "diego",
      "ana",
    ]);
    expect(repartirEntre(lista, []).map((x) => x.responsableId)).toEqual([
      "diego",
      null,
      null,
      null,
    ]);
  });
});

describe("plantilla de los gatos", () => {
  it("limpia los areneros cada día, compra arena y comida, y no se mezcla con la de la casa", () => {
    const porTitulo = (t: string) => PLANTILLA_GATOS.find((p) => p.titulo === t);
    expect(porTitulo("Limpiar los areneros")).toMatchObject({ cadaDias: 1, empiezaEn: 0 });
    expect(PLANTILLA_GATOS.filter((p) => p.compra).map((p) => p.compra)).toEqual([
      "Arena para gatos",
      "Comida de los gatos",
    ]);
    const todos = [...PLANTILLA_CASA, ...PLANTILLA_GATOS].map((p) => p.titulo);
    expect(new Set(todos).size).toBe(todos.length);
    expect(PLANTILLAS.gatos).toBe(PLANTILLA_GATOS);
    expect(PLANTILLAS.casa).toBe(PLANTILLA_CASA);
  });
});
