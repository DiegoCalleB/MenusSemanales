import { describe, expect, it } from "vitest";
import type { FechaIso } from "./fechas";
import { esUuid } from "./identificadores";
import {
  type EntradaRegistro,
  claveDeQue,
  cosasDeHoy,
  idDeEntrada,
  limpiarQue,
  resumenPorPersona,
} from "./registro";
import type { Persona } from "./tipos";

const hoy = "2026-11-03" as FechaIso;
const e = (fecha: string, que: string, personaId = "d"): EntradaRegistro => ({
  id: idDeEntrada(fecha as FechaIso, que, personaId),
  fecha: fecha as FechaIso,
  que,
  personaId,
});

describe("registro", () => {
  it("el id es un UUID estable: la misma cosa el mismo día por la misma persona no se duplica", () => {
    const a = idDeEntrada(hoy, "Cena", "p1");
    expect(esUuid(a)).toBe(true);
    expect(idDeEntrada(hoy, "  cena ", "p1")).toBe(a);
    expect(idDeEntrada(hoy, "Cena", "p2")).not.toBe(a);
    expect(idDeEntrada("2026-11-04" as FechaIso, "Cena", "p1")).not.toBe(a);
  });

  it("la clave ignora mayúsculas, tildes y espacios; el texto se recorta", () => {
    expect(claveDeQue("  Poner   LAVAVAJILLAS ")).toBe("poner lavavajillas");
    expect(claveDeQue("Cañón")).toBe("canon");
    expect(limpiarQue("x".repeat(100))).toHaveLength(40);
  });

  it("hoy salen siempre comida, cena y compra, más lo que se apuntó hoy", () => {
    const r = [e(hoy, "Gatos"), e(hoy, "cena")];
    expect(cosasDeHoy(r, hoy).hoy).toEqual(["Comida", "Cena", "Compra", "Gatos"]);
  });

  it("sugiere lo apuntado otros días, lo más frecuente primero, sin repetir lo de hoy", () => {
    const r = [
      e("2026-11-01", "Lavavajillas"),
      e("2026-11-02", "lavavajillas"),
      e("2026-11-02", "Gatos"),
      e(hoy, "Gatos"),
      e("2026-10-30", "Cena"),
    ];
    const c = cosasDeHoy(r, hoy);
    expect(c.hoy).toContain("Gatos");
    expect(c.sugerencias).toEqual(["Lavavajillas"]);
  });

  it("cuenta cosas por persona en un rango y solo de personas activas", () => {
    const personas: Persona[] = [
      { id: "d", nombre: "Diego", tipo: "adulto", activa: true, factorRacion: 1 },
      { id: "a", nombre: "Ana", tipo: "adulto", activa: true, factorRacion: 1 },
      { id: "x", nombre: "Inactiva", tipo: "adulto", activa: false, factorRacion: 1 },
    ];
    const r = [e(hoy, "Cena", "d"), e(hoy, "Compra", "d"), e("2026-10-01", "Cena", "a")];
    expect(
      resumenPorPersona(r, personas, "2026-11-01" as FechaIso, "2026-11-07" as FechaIso),
    ).toEqual([
      { personaId: "d", cosas: 2 },
      { personaId: "a", cosas: 0 },
    ]);
  });
});
