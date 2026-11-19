import { describe, expect, it } from "vitest";
import { cuantoQueda, leerLista, plazoDeTexto, plazoLargo, porPlazo } from "./objetivos";

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
          textos: ["Linea magica crecer mucho", "Estudiar marketing digital"],
        },
        {
          hasta: "2027-03-31",
          textos: ["Dar a conocer bandmanager!", "Estudiar marketing digital"],
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
