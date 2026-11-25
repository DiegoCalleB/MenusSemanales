import { describe, expect, it } from "vitest";
import {
  type Repetida,
  eventosDeRepetidas,
  ocurrenciasDe,
  posponerUnaSemana,
  proximaDe,
  textoRepeticion,
  validarRepetida,
} from "./repetidas";

const yolanda: Repetida = {
  id: "y",
  titulo: "Viene Yolanda",
  hora: null,
  desde: "2026-11-25",
  cadaDias: 14,
  avisoAntes: "Dejar dinero para Yolanda",
  creadoEn: "2026-11-25",
};

describe("fechas que se repiten (D-211)", () => {
  it("cae siempre el mismo día, cada 2 semanas, sin marcar nada", () => {
    expect(proximaDe(yolanda, "2026-11-25")).toBe("2026-11-25");
    expect(proximaDe(yolanda, "2026-11-26")).toBe("2026-12-09");
    expect(proximaDe(yolanda, "2026-12-09")).toBe("2026-12-09");
    expect(proximaDe(yolanda, "2026-12-10")).toBe("2026-12-23");
    expect(proximaDe({ desde: "2026-12-02", cadaDias: 14 }, "2026-11-25")).toBe("2026-12-02");
    expect(ocurrenciasDe(yolanda, "2026-11-25", "2027-01-10")).toEqual([
      "2026-11-25",
      "2026-12-09",
      "2026-12-23",
      "2027-01-06",
    ]);
  });

  it("saca las citas del día y el recordatorio del día antes, sin copiarlas", () => {
    const r = eventosDeRepetidas([yolanda], "2026-11-24", "2026-12-10");
    expect(r.map((x) => [x.fecha, x.titulo])).toEqual([
      ["2026-11-24", "Dejar dinero para Yolanda"],
      ["2026-11-25", "Viene Yolanda"],
      ["2026-12-08", "Dejar dinero para Yolanda"],
      ["2026-12-09", "Viene Yolanda"],
    ]);
    expect(new Set(r.map((x) => x.id)).size).toBe(4);
    // El recordatorio del primer día de la ventana (el día antes de una vez que cae justo después).
    expect(eventosDeRepetidas([yolanda], "2026-12-08", "2026-12-08").map((x) => x.titulo)).toEqual([
      "Dejar dinero para Yolanda",
    ]);
  });

  it("posponer: la próxima vez pasa una semana y desde ahí sigue cada 2 semanas", () => {
    const hoy = "2026-11-25";
    const p = posponerUnaSemana(yolanda, hoy);
    expect(p.desde).toBe("2026-12-02");
    expect(ocurrenciasDe(p, hoy, "2026-12-31")).toEqual(["2026-12-02", "2026-12-16", "2026-12-30"]);
    // Si se pospone otra vez, otra semana más.
    expect(posponerUnaSemana(p, hoy).desde).toBe("2026-12-09");
    // Pospuesta desde un día intermedio, se refiere a la próxima vez que toca.
    expect(posponerUnaSemana(yolanda, "2026-11-30").desde).toBe("2026-12-16");
  });

  it("valida lo que se apunta", () => {
    const ok = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);
    const base = {
      titulo: " Viene   Yolanda ",
      hora: null,
      desde: "2026-11-25",
      cadaDias: 14,
      avisoAntes: " Dejar dinero ",
    };
    expect(validarRepetida(base, ok)).toMatchObject({
      ok: true,
      datos: { titulo: "Viene Yolanda", avisoAntes: "Dejar dinero" },
    });
    expect(validarRepetida({ ...base, titulo: " " }, ok).ok).toBe(false);
    expect(validarRepetida({ ...base, desde: "mañana" }, ok).ok).toBe(false);
    expect(validarRepetida({ ...base, cadaDias: 0 }, ok).ok).toBe(false);
    expect(validarRepetida({ ...base, hora: "25:00" }, ok).ok).toBe(false);
    expect(validarRepetida({ ...base, avisoAntes: "" }, ok)).toMatchObject({
      ok: true,
      datos: { avisoAntes: null },
    });
    expect(textoRepeticion(14)).toBe("cada 2 semanas");
    expect(textoRepeticion(7)).toBe("cada semana");
    expect(textoRepeticion(10)).toBe("cada 10 días");
  });
});
