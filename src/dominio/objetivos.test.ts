import { describe, expect, it } from "vitest";
import {
  cuantoQueda,
  haceCuanto,
  leerLista,
  parados,
  plazoDeTexto,
  plazoLargo,
  porPlazo,
  quePideHacer,
  separarCada,
  sinPaso,
  textoCada,
} from "./objetivos";

const HOY = "2026-11-19";

describe("plazoDeTexto", () => {
  it("entiende cómo se escribe a mano", () => {
    expect(plazoDeTexto("Objetivos hasta 31 diciembre 2026", HOY)).toBe("2026-12-31");
    expect(plazoDeTexto("Objetivo hasta Marzo 2027", HOY)).toBe("2027-03-31");
    expect(plazoDeTexto("hasta el 15 de junio", HOY)).toBe("2027-06-15");
    expect(plazoDeTexto("Marzo 2027:", HOY)).toBe("2027-03-31");
    expect(plazoDeTexto("Hasta febrero de 2028", HOY)).toBe("2028-02-29");
  });
  it("sin año, el próximo que no haya pasado", () => {
    expect(plazoDeTexto("hasta diciembre", HOY)).toBe("2026-12-31");
    expect(plazoDeTexto("hasta marzo", HOY)).toBe("2027-03-31");
  });
  it("lo que no es un plazo no lo es (marketing no es marzo)", () => {
    expect(plazoDeTexto("Estudiar marketing digital", HOY)).toBeNull();
    expect(plazoDeTexto("Viaje a Marruecos", HOY)).toBeNull();
    expect(plazoDeTexto("hasta 31 febrero 2027", HOY)).toBeNull();
  });
});

describe("leerLista", () => {
  it("agrupa por plazo, con o sin guiones, sin repetir", () => {
    const r = leerLista(
      `Objetivos hasta 31 diciembre 2026
Linea magica crecer mucho
- Estudiar marketing digital
Estudiar marketing digital

Objetivo hasta Marzo 2027
Dar a conocer bandmanager!
Estudiar marketing digital`,
      HOY,
    );
    expect(r).toEqual({
      ok: true,
      grupos: [
        {
          hasta: "2026-12-31",
          items: [
            { texto: "Linea magica crecer mucho", cada: null },
            { texto: "Estudiar marketing digital", cada: null },
          ],
        },
        {
          hasta: "2027-03-31",
          items: [
            { texto: "Dar a conocer bandmanager!", cada: null },
            { texto: "Estudiar marketing digital", cada: null },
          ],
        },
      ],
    });
  });
  it("avisa si falta el plazo, si está vacía o si algo es demasiado largo", () => {
    expect(leerLista("Publicar más juegos", HOY).ok).toBe(false);
    expect(leerLista("Hasta marzo 2027", HOY).ok).toBe(false);
    expect(leerLista(`Hasta marzo 2027\n${"x".repeat(101)}`, HOY).ok).toBe(false);
  });
});

describe("porPlazo y textos", () => {
  const o = (id: string, hasta: string, hechoEn: string | null, personaId = "a") => ({
    id,
    personaId,
    texto: id,
    hasta,
    hechoEn,
    creadoEn: "2026-11-01",
    siguiente: null,
    movidoEn: null,
    cada: null,
  });
  it("ordena por plazo, lo pendiente antes que lo hecho, y solo de esa persona", () => {
    const g = porPlazo(
      [
        o("1", "2027-03-31", null),
        o("2", "2026-12-31", "2026-11-01"),
        o("3", "2026-12-31", null),
        o("4", "2026-12-31", null, "b"),
      ],
      "a",
    );
    expect(g.map((x) => x.hasta)).toEqual(["2026-12-31", "2027-03-31"]);
    expect(g[0]?.objetivos.map((x) => x.id)).toEqual(["3", "2"]);
    expect(g[0]?.hechos).toBe(1);
  });
  it("dice cuánto queda", () => {
    expect(plazoLargo("2026-12-31")).toBe("31 de diciembre de 2026");
    expect(cuantoQueda("2026-11-19", HOY)).toBe("es hoy");
    expect(cuantoQueda("2026-12-31", HOY)).toBe("quedan 42 días");
    expect(cuantoQueda("2027-03-31", HOY)).toBe("quedan 4 meses");
    expect(cuantoQueda("2026-11-16", HOY)).toBe("venció hace 3 días");
  });
});

describe("repetición, pasos y parados (D-198)", () => {
  const base = {
    id: "x",
    personaId: "a",
    texto: "Plan a solas con Lucía",
    hasta: "2026-12-31",
    hechoEn: null,
    creadoEn: "2026-10-01",
    siguiente: null,
    movidoEn: null,
    cada: null,
  };
  it("separa «(cada semana)» del texto", () => {
    expect(separarCada("Plan a solas con Lucía (cada semana)")).toEqual({
      texto: "Plan a solas con Lucía",
      cada: 7,
    });
    expect(separarCada("Llamar a mis padres (cada 2 semanas)").cada).toBe(14);
    expect(separarCada("Revisar cuentas (cada mes)").cada).toBe(30);
    expect(separarCada("Beber agua (cada día)").cada).toBe(1);
    expect(separarCada("Cosa (cada 10 días)").cada).toBe(10);
    expect(separarCada("Viaje a Marruecos")).toEqual({ texto: "Viaje a Marruecos", cada: null });
    expect(separarCada("Algo (cada siglo)").cada).toBeNull();
    expect(textoCada(7)).toBe("cada semana");
    expect(textoCada(14)).toBe("cada 2 semanas");
    expect(textoCada(30)).toBe("cada mes");
    expect(textoCada(10)).toBe("cada 10 días");
  });
  it("lee las repeticiones de una lista pegada", () => {
    const r = leerLista("Hasta diciembre\nPlan con Lucía (cada semana)\nViaje", "2026-11-19");
    expect(r.ok && r.grupos[0]?.items).toEqual([
      { texto: "Plan con Lucía", cada: 7 },
      { texto: "Viaje", cada: null },
    ]);
  });
  it("dice qué toca hacer, qué está parado y qué no tiene paso", () => {
    const hoy = "2026-11-19";
    const os = [
      { ...base, id: "r1", cada: 7, movidoEn: "2026-11-10" },
      { ...base, id: "r2", cada: 7, movidoEn: "2026-11-17" },
      { ...base, id: "p1", texto: "Parado", cada: null, creadoEn: "2026-10-01" },
      { ...base, id: "p2", texto: "Reciente", cada: null, creadoEn: "2026-11-15" },
      {
        ...base,
        id: "p3",
        texto: "Con paso",
        cada: null,
        creadoEn: "2026-10-01",
        siguiente: "x",
        movidoEn: "2026-11-18",
      },
      {
        ...base,
        id: "h",
        texto: "Hecho",
        cada: null,
        creadoEn: "2026-09-01",
        hechoEn: "2026-11-01",
      },
    ];
    expect(quePideHacer(os, "a", hoy).map((x) => [x.objetivo.id, x.dias])).toEqual([["r1", 9]]);
    expect(parados(os, "a", hoy).map((x) => x.objetivo.id)).toEqual(["p1"]);
    expect(sinPaso(os, "a")).toBe(4);
    expect(haceCuanto(0)).toBe("hoy");
    expect(haceCuanto(21)).toBe("hace 3 semanas");
  });
});
