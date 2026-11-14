import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "./datos-demo";
import type { EstadoHogar } from "./estado";
import { planDeLaSemana, rangoDeLaSemana, textoDelPlan } from "./semana";

describe("plan de la semana (D-137)", () => {
  it("el fin de semana planea la siguiente; entre semana, lo que queda de esta", () => {
    expect(rangoDeLaSemana("2026-11-15")).toEqual({ desde: "2026-11-16", hasta: "2026-11-22" });
    expect(rangoDeLaSemana("2026-11-14")).toEqual({ desde: "2026-11-16", hasta: "2026-11-22" });
    expect(rangoDeLaSemana("2026-11-18")).toEqual({ desde: "2026-11-18", hasta: "2026-11-22" });
    expect(rangoDeLaSemana("2026-11-16")).toEqual({ desde: "2026-11-16", hasta: "2026-11-22" });
  });

  it("junta por día citas, cenas que faltan, qué preparar y cumpleaños", () => {
    const e: EstadoHogar = {
      ...estadoInicialDemo(),
      hoy: "2026-11-15",
      comidas: [],
      saltados: ["2026-11-21"],
      eventos: {},
      agenda: [{ id: "a1", fecha: "2026-11-18", hasta: null, hora: "16:00", titulo: "Reu AMPA" }],
      cumples: [],
      casa: [],
    } as EstadoHogar;
    const plan = planDeLaSemana(e);
    expect(plan.dias).toHaveLength(7);
    expect(plan.dias[0]!.nombre).toBe("lunes 16");
    expect(plan.dias[2]!.citas).toEqual([
      { id: expect.any(String), titulo: "Reu AMPA", hora: "16:00" },
    ]);
    // Los patines de Emma (viernes) se preparan el jueves 19; el piano de Alba (martes), el lunes 16.
    // Con su id y el día para el que es: así se marca desde el plan (D-153).
    expect(plan.dias[3]!.preparar).toEqual([
      {
        id: expect.any(String),
        para: "2026-11-20",
        texto: "Patines",
        persona: "Emma",
        hecho: false,
      },
    ]);
    expect(plan.dias[0]!.preparar.map((p) => p.texto)).toEqual(["Carpeta de piano"]);
    expect(plan.faltanCenas).toBe(6); // el sábado 21 no se cena en casa
    expect(plan.faltanCenasLaborables).toBe(5);
    const texto = textoDelPlan(plan);
    expect(texto).toContain("*Miércoles 18*\n📌 16:00 Reu AMPA");
    expect(texto).toContain("🎒 Preparar: Patines (Emma)");
  });
});
