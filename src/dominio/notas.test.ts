import { describe, expect, it } from "vitest";
import {
  type Nota,
  archivadas,
  bandeja,
  hace,
  recuerdos,
  unDiaComoHoy,
  validarNota,
} from "./notas";

const n = (id: string, over: Partial<Nota> = {}): Nota => ({
  id,
  personaId: "a",
  tipo: "idea",
  texto: id,
  sobre: null,
  creadoEn: "2026-11-01",
  procesadaEn: null,
  ...over,
});

describe("notas e ideas, y recuerdos (D-199)", () => {
  const personas = new Set(["a", "b"]);
  it("valida el texto, el tipo y las personas", () => {
    expect(
      validarNota(
        { personaId: "a", tipo: "idea", texto: "  hola   mundo ", sobre: null },
        personas,
      ),
    ).toMatchObject({ ok: true, datos: { texto: "hola mundo" } });
    expect(validarNota({ personaId: "a", tipo: "idea", texto: "", sobre: null }, personas).ok).toBe(
      false,
    );
    expect(
      validarNota({ personaId: "a", tipo: "idea", texto: "x".repeat(501), sobre: null }, personas)
        .ok,
    ).toBe(false);
    expect(
      validarNota({ personaId: "z", tipo: "idea", texto: "x", sobre: null }, personas).ok,
    ).toBe(false);
    expect(
      validarNota({ personaId: "a", tipo: "recuerdo", texto: "x", sobre: "z" }, personas).ok,
    ).toBe(false);
  });
  it("la bandeja son las ideas sin resolver de esa persona; los recuerdos, por fecha", () => {
    const todas = [
      n("1", { creadoEn: "2026-11-03" }),
      n("2", { creadoEn: "2026-11-01" }),
      n("3", { procesadaEn: "2026-11-05" }),
      n("4", { personaId: "b" }),
      n("5", { tipo: "recuerdo", sobre: "b", creadoEn: "2026-10-01" }),
      n("6", { tipo: "recuerdo", creadoEn: "2026-10-20" }),
    ];
    expect(bandeja(todas, "a").map((x) => x.id)).toEqual(["2", "1"]);
    expect(archivadas(todas, "a").map((x) => x.id)).toEqual(["3"]);
    expect(recuerdos(todas, "a").map((x) => x.id)).toEqual(["6", "5"]);
    expect(recuerdos(todas, "a", "b").map((x) => x.id)).toEqual(["5"]);
  });
  it("un día como hoy: a 1, 3 y 6 meses y cada año, y solo de esa persona", () => {
    expect(hace(30)).toBe("hace 1 mes");
    expect(hace(91)).toBe("hace 3 meses");
    expect(hace(182)).toBe("hace 6 meses");
    expect(hace(365)).toBe("hace 1 año");
    expect(hace(731)).toBe("hace 2 años");
    expect(hace(100)).toBeNull();
    const todas = [
      n("r1", { tipo: "recuerdo", creadoEn: "2025-11-19", texto: "Primer diente" }),
      n("r2", { tipo: "recuerdo", creadoEn: "2026-11-10" }),
      n("r3", { tipo: "recuerdo", creadoEn: "2025-11-19", personaId: "b" }),
    ];
    expect(unDiaComoHoy(todas, "a", "2026-11-19").map((x) => [x.nota.id, x.hace])).toEqual([
      ["r1", "hace 1 año"],
    ]);
  });
});
