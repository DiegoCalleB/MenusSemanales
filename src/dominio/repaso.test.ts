import { describe, expect, it } from "vitest";
import type { Cuidado } from "./cuidado";
import { repasoDeLaSemana } from "./repaso";

// 2026-11-15 es domingo: la semana va del lunes 9 al domingo 15.
const hoy = "2026-11-15";
const cuidado: Cuidado = {
  personaId: "d",
  metaAgua: 2,
  habitos: [{ id: "h1", nombre: "Leer" }],
  ejercicio: { nombre: "Correr", dias: [1, 3] },
  avisos: false,
  avisoDia: null,
  dias: {
    "2026-11-09": { agua: 2, habitos: ["h1"], ejercicio: true },
    "2026-11-10": { agua: 1, habitos: [], ejercicio: false },
    "2026-11-11": { agua: 3, habitos: ["h1"], ejercicio: true },
  },
};

describe("revisión de la semana (D-191)", () => {
  const r = repasoDeLaSemana({
    hoy,
    casa: [
      { titulo: "Arenero", emoji: "🐱", ultimaVez: "2026-11-14" },
      { titulo: "Plantas", emoji: "🪴", ultimaVez: "2026-11-02" },
    ],
    pendientes: [
      {
        id: "1",
        texto: "Llamar al fontanero",
        personaId: null,
        importante: true,
        creadoEn: "2026-10-20",
        hechoEn: null,
      },
      {
        id: "2",
        texto: "Pedir cita",
        personaId: null,
        importante: false,
        creadoEn: "2026-11-14",
        hechoEn: null,
      },
      {
        id: "3",
        texto: "Arreglar la persiana",
        personaId: null,
        importante: false,
        creadoEn: "2026-11-01",
        hechoEn: "2026-11-12",
      },
    ],
    cuidado,
    agenda: [
      { fecha: "2026-11-17", hasta: null, titulo: "Pediatra", hora: "17:00" },
      { fecha: "2026-12-30", hasta: null, titulo: "Lejos", hora: null },
    ],
    vencimientos: [
      {
        id: "v",
        titulo: "ITV",
        categoria: "coche",
        personaId: null,
        fecha: "2026-11-25",
        repiteMeses: 12,
        avisos: [],
        notas: "",
        hechoEn: null,
        renovado: [],
      },
    ],
    cumples: [
      { nombre: "Ana", dia: 20, mes: 11 },
      { nombre: "Leo", dia: 1, mes: 3 },
    ],
  });

  it("cuenta lo hecho esta semana", () => {
    expect(r.desde).toBe("2026-11-09");
    expect(r.hecho.casa).toEqual(["🐱 Arenero"]);
    expect(r.hecho.pendientes).toEqual(["Arreglar la persiana"]);
    expect(r.hecho.miDia).toEqual({ completos: 2, dias: 7 });
    expect(r.hecho.agua).toEqual({ cumplidos: 2 });
    expect(r.hecho.ejercicio).toEqual({ hechas: 2, objetivo: 2 });
  });

  it("enseña lo que se quedó, solo lo que lleva una semana o más", () => {
    expect(r.quedo.pendientesViejos.map((p) => p.texto)).toEqual(["Llamar al fontanero"]);
    expect(r.quedo.totalPendientes).toBe(2);
  });

  it("y lo que viene en los próximos días", () => {
    expect(r.viene.citas.map((c) => c.titulo)).toEqual(["Pediatra"]);
    expect(r.viene.papeles).toEqual([{ titulo: "ITV", dias: 10 }]);
    expect(r.viene.cumples).toEqual([{ nombre: "Ana", dias: 5 }]);
  });

  it("sin datos personales no inventa nada", () => {
    const v = repasoDeLaSemana({
      hoy,
      casa: [],
      pendientes: [],
      cuidado: null,
      agenda: [],
      vencimientos: [],
      cumples: [],
    });
    expect(v.hecho.miDia).toBeNull();
    expect(v.hecho.agua).toBeNull();
    expect(v.hecho.ejercicio).toBeNull();
  });
});
