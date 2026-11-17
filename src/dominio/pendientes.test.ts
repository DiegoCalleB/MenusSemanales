import { describe, expect, it } from "vitest";
import {
  type Pendiente,
  abiertos,
  deLaPersona,
  hechosRecientes,
  paraHoy,
  recordatorioSemanal,
  sinHechosViejos,
  textoEspera,
  validarPendiente,
} from "./pendientes";

const p = (o: Partial<Pendiente> = {}): Pendiente => ({
  id: "p1",
  texto: "Llamar al fontanero",
  personaId: null,
  importante: false,
  creadoEn: "2026-11-01",
  hechoEn: null,
  ...o,
});
const HOY = "2026-11-17";

describe("pendientes sin fecha (D-175)", () => {
  it("ordena lo importante primero y, dentro, lo más antiguo", () => {
    const l = abiertos([
      p({ id: "a", creadoEn: "2026-11-10" }),
      p({ id: "b", creadoEn: "2026-11-02" }),
      p({ id: "c", creadoEn: "2026-11-16", importante: true }),
      p({ id: "d", creadoEn: "2026-10-01", hechoEn: "2026-11-01" }),
    ]);
    expect(l.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("los hechos se enseñan dos semanas y luego se olvidan", () => {
    const ps = [
      p({ id: "a", hechoEn: "2026-11-16" }),
      p({ id: "b", hechoEn: "2026-11-03" }),
      p({ id: "c", hechoEn: "2026-11-02" }),
      p({ id: "d" }),
    ];
    expect(hechosRecientes(ps, HOY).map((x) => x.id)).toEqual(["a", "b"]);
    expect(sinHechosViejos(ps, HOY).map((x) => x.id)).toEqual(["a", "b", "d"]);
  });

  it("cuánto lleva esperando", () => {
    expect(textoEspera("2026-11-17", HOY)).toBe("de hoy");
    expect(textoEspera("2026-11-16", HOY)).toBe("de ayer");
    expect(textoEspera("2026-11-12", HOY)).toBe("hace 5 días");
    expect(textoEspera("2026-10-27", HOY)).toBe("hace 3 semanas");
    expect(textoEspera("2026-08-17", HOY)).toBe("hace 3 meses");
    expect(textoEspera("2026-12-01", HOY)).toBe("de hoy");
  });

  it("«Hoy» enseña lo de esa persona y lo que no es de nadie, máximo tres", () => {
    const ps = [
      p({ id: "a", personaId: "diego" }),
      p({ id: "b", personaId: "ana" }),
      p({ id: "c" }),
      p({ id: "d", personaId: "diego", importante: true }),
      p({ id: "e", personaId: "diego", creadoEn: "2026-11-10" }),
    ];
    expect(deLaPersona(ps, "diego").map((x) => x.id)).not.toContain("b");
    expect(paraHoy(ps, "diego").map((x) => x.id)).toEqual(["d", "a", "c"]);
    // Sin perfil, solo lo que no es de nadie.
    expect(paraHoy(ps, null).map((x) => x.id)).toEqual(["c"]);
  });

  it("el recordatorio del domingo solo si merece la pena", () => {
    expect(recordatorioSemanal([], HOY)).toBeNull();
    expect(recordatorioSemanal([p({ creadoEn: "2026-11-15" })], HOY)).toBeNull();
    expect(recordatorioSemanal([p({ creadoEn: "2026-11-10" })], HOY)?.cuantos).toBe(1);
    const r = recordatorioSemanal(
      [
        p({ id: "a", creadoEn: "2026-11-16", importante: true }),
        p({ id: "b", creadoEn: "2026-10-01" }),
      ],
      HOY,
    );
    expect(r).toMatchObject({ cuantos: 2, primero: { id: "a" } });
    expect(
      recordatorioSemanal([p({ hechoEn: "2026-11-01", creadoEn: "2026-10-01" })], HOY),
    ).toBeNull();
  });

  it("valida lo que se escribe", () => {
    const personas = new Set(["diego"]);
    expect(
      validarPendiente(
        { texto: "  Arreglar   la persiana ", personaId: "diego", importante: true },
        personas,
      ),
    ).toEqual({
      ok: true,
      datos: { texto: "Arreglar la persiana", personaId: "diego", importante: true },
    });
    const mal = (o: object) =>
      validarPendiente({ texto: "x", personaId: null, importante: false, ...o }, personas);
    expect(mal({ texto: " " }).ok).toBe(false);
    expect(mal({ texto: "x".repeat(121) }).ok).toBe(false);
    expect(mal({ personaId: "nadie" }).ok).toBe(false);
  });
});
