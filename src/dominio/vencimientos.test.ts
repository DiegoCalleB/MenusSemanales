import { describe, expect, it } from "vitest";
import {
  PLANTILLAS,
  type Vencimiento,
  agrupar,
  avisosDeVencimientos,
  estadoDe,
  fechaAlRenovar,
  paraHoy,
  renovar,
  sumarMeses,
  textoCuando,
  textoRepite,
  validarDatos,
} from "./vencimientos";

const v = (o: Partial<Vencimiento> = {}): Vencimiento => ({
  id: "v1",
  titulo: "ITV del coche",
  categoria: "coche",
  personaId: null,
  fecha: "2026-12-04",
  repiteMeses: 12,
  avisos: [30, 7, 1],
  notas: "",
  hechoEn: null,
  renovado: [],
  ...o,
});
const HOY = "2026-11-04";

describe("papeles y vencimientos (D-174)", () => {
  it("suma meses sin pasarse de mes y respeta los bisiestos", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2027-12-31", 2)).toBe("2028-02-29");
    expect(sumarMeses("2024-02-29", 12)).toBe("2025-02-28");
    expect(sumarMeses("2026-11-15", 12)).toBe("2027-11-15");
    expect(sumarMeses("2026-11-15", 120)).toBe("2036-11-15");
    expect(sumarMeses("2026-12-10", 1)).toBe("2027-01-10");
  });

  it("el estado: vencido, urgente (7 días), pronto (30) o lejos", () => {
    expect(estadoDe(v({ fecha: "2026-11-03" }), HOY)).toBe("vencido");
    expect(estadoDe(v({ fecha: HOY }), HOY)).toBe("urgente");
    expect(estadoDe(v({ fecha: "2026-11-11" }), HOY)).toBe("urgente");
    expect(estadoDe(v({ fecha: "2026-11-12" }), HOY)).toBe("pronto");
    expect(estadoDe(v({ fecha: "2026-12-04" }), HOY)).toBe("pronto");
    expect(estadoDe(v({ fecha: "2026-12-05" }), HOY)).toBe("lejos");
  });

  it("al renovar propone la siguiente fecha que aún no ha pasado", () => {
    expect(fechaAlRenovar(v({ fecha: "2026-12-04" }), HOY)).toBe("2027-12-04");
    // Si se renueva tarde, salta las que ya pasaron.
    expect(fechaAlRenovar(v({ fecha: "2023-03-10", repiteMeses: 12 }), HOY)).toBe("2027-03-10");
    expect(fechaAlRenovar(v({ repiteMeses: null }), HOY)).toBeNull();
  });

  it("renovar guarda la fecha anterior (solo las cinco últimas) y reabre", () => {
    let x = v({ hechoEn: null });
    for (let i = 1; i <= 7; i++) x = renovar(x, `${2026 + i}-12-04`);
    expect(x.fecha).toBe("2033-12-04");
    expect(x.renovado).toHaveLength(5);
    expect(x.renovado[0]).toBe("2028-12-04");
  });

  it("los textos: cuándo vence y cada cuánto se repite", () => {
    expect(textoCuando(0)).toBe("vence hoy");
    expect(textoCuando(1)).toBe("vence mañana");
    expect(textoCuando(12)).toBe("vence en 12 días");
    expect(textoCuando(90)).toBe("vence en 3 meses");
    expect(textoCuando(-1)).toBe("venció ayer");
    expect(textoCuando(-5)).toBe("venció hace 5 días");
    expect(textoCuando(-100)).toBe("venció hace 3 meses");
    expect(textoRepite(null)).toBe("no se repite");
    expect(textoRepite(12)).toBe("cada año");
    expect(textoRepite(24)).toBe("cada 2 años");
    expect(textoRepite(6)).toBe("cada 6 meses");
    expect(textoRepite(18)).toBe("cada 18 meses");
  });

  it("agrupa: vencidos, próximos 30 días, después y hechos (los últimos hechos, primero)", () => {
    const g = agrupar(
      [
        v({ id: "a", fecha: "2026-10-30" }),
        v({ id: "b", fecha: "2026-11-20" }),
        v({ id: "c", fecha: "2027-03-01" }),
        v({ id: "d", fecha: "2026-09-01", hechoEn: "2026-09-02" }),
        v({ id: "e", fecha: "2026-08-01", hechoEn: "2026-08-02" }),
      ],
      HOY,
    );
    expect(g.vencidos.map((x) => x.id)).toEqual(["a"]);
    expect(g.proximos.map((x) => x.id)).toEqual(["b"]);
    expect(g.despues.map((x) => x.id)).toEqual(["c"]);
    expect(g.hechos.map((x) => x.id)).toEqual(["d", "e"]);
  });

  it("«Hoy» enseña lo vencido y lo de las dos próximas semanas, no lo hecho", () => {
    const lista = paraHoy(
      [
        v({ id: "a", fecha: "2026-10-01" }),
        v({ id: "b", fecha: "2026-11-18" }),
        v({ id: "c", fecha: "2026-11-19" }),
        v({ id: "d", fecha: "2026-11-05", hechoEn: "2026-11-01" }),
      ],
      HOY,
    );
    expect(lista.map((x) => x.id)).toEqual(["a", "b"]);
  });

  describe("avisos", () => {
    const personas = [{ id: "alba", nombre: "Alba" }];
    it("avisa solo en los días de margen elegidos", () => {
      const x = v({ fecha: "2026-12-04" });
      expect(avisosDeVencimientos([x], "2026-11-04", personas)).toEqual([
        { id: "papel-v1-30", texto: "ITV del coche vence en 30 días", nivel: "info", dias: 30 },
      ]);
      expect(avisosDeVencimientos([x], "2026-11-05", personas)).toEqual([]);
      expect(avisosDeVencimientos([x], "2026-11-27", personas)[0]).toMatchObject({
        texto: "ITV del coche vence en 7 días",
        nivel: "pronto",
      });
      expect(avisosDeVencimientos([x], "2026-12-03", personas)[0]).toMatchObject({
        texto: "ITV del coche vence mañana",
        nivel: "ya",
      });
    });
    it("lo vencido se recuerda al día siguiente, a la semana, a las dos y al mes", () => {
      const x = v({ fecha: "2026-11-04", avisos: [] });
      const dias = [1, 2, 7, 8, 14, 30, 31].map(
        (n) => avisosDeVencimientos([x], sumarD("2026-11-04", n), personas).length,
      );
      expect(dias).toEqual([1, 0, 1, 0, 1, 1, 0]);
      expect(avisosDeVencimientos([x], "2026-11-05", personas)[0]?.texto).toBe(
        "ITV del coche venció ayer",
      );
    });
    it("pone de quién es y no avisa de lo hecho", () => {
      const x = v({ titulo: "Pasaporte", personaId: "alba", fecha: "2026-12-04", avisos: [30] });
      expect(avisosDeVencimientos([x], HOY, personas)[0]?.texto).toBe(
        "Pasaporte de Alba vence en 30 días",
      );
      expect(avisosDeVencimientos([{ ...x, hechoEn: "2026-10-01" }], HOY, personas)).toEqual([]);
    });
    it("el aviso de un día tiene siempre el mismo id (no se repite en el móvil)", () => {
      const a = avisosDeVencimientos([v()], HOY, [])[0]?.id;
      const b = avisosDeVencimientos([v()], HOY, [])[0]?.id;
      expect(a).toBe(b);
    });
  });

  describe("validar lo que se escribe", () => {
    const base = {
      titulo: "  Seguro   del coche ",
      categoria: "coche" as const,
      personaId: null,
      fecha: "2027-02-10",
      repiteMeses: 12,
      avisos: [7, 30, 30],
      notas: " Mapfre ",
    };
    const personas = new Set(["alba"]);
    it("limpia espacios, ordena los avisos y quita repetidos", () => {
      const r = validarDatos(base, personas);
      expect(r).toEqual({
        ok: true,
        datos: { ...base, titulo: "Seguro del coche", avisos: [30, 7], notas: "Mapfre" },
      });
    });
    it("rechaza lo que no vale, con un motivo para enseñar", () => {
      const motivo = (o: object) => {
        const r = validarDatos({ ...base, ...o }, personas);
        return r.ok ? "ok" : r.motivo;
      };
      expect(motivo({ titulo: "  " })).toContain("nombre");
      expect(motivo({ titulo: "x".repeat(81) })).toContain("nombre");
      expect(motivo({ fecha: "2027-02-30" })).toContain("día");
      expect(motivo({ fecha: "mañana" })).toContain("día");
      expect(motivo({ personaId: "desconocida" })).toContain("persona");
      expect(motivo({ repiteMeses: 0 })).toContain("repite");
      expect(motivo({ repiteMeses: 1.5 })).toContain("repite");
      expect(motivo({ avisos: [5] })).toContain("avisos");
      expect(motivo({ categoria: "x" })).toContain("tipo");
      expect(motivo({ notas: "x".repeat(301) })).toContain("notas");
      expect(motivo({ personaId: "alba", repiteMeses: null })).toBe("ok");
    });
  });

  it("las plantillas son coherentes: ids únicos, avisos de la lista y repetición válida", () => {
    expect(new Set(PLANTILLAS.map((p) => p.id)).size).toBe(PLANTILLAS.length);
    for (const p of PLANTILLAS) {
      expect(p.titulo.length).toBeLessThanOrEqual(80);
      expect(p.avisos.length).toBeGreaterThan(0);
      expect(p.avisos).toEqual([...p.avisos].sort((a, b) => b - a));
      if (p.repiteMeses !== null) expect(p.repiteMeses).toBeGreaterThan(0);
    }
  });
});

function sumarD(f: string, n: number): string {
  return new Date(Date.parse(`${f}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
