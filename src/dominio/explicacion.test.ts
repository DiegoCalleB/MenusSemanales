import { describe, expect, it } from "vitest";
import { contarSemana, estadoDelGrupo } from "./equilibrio";
import { explicarOpcion } from "./explicacion";
import type { DiaMenu, PlatoMenu } from "./menu";
import { formatearLista } from "./texto";

const plato = (extra: Partial<PlatoMenu> = {}): PlatoMenu => ({
  id: "p",
  nombre: "Salmón a la plancha",
  grupo: "pescado",
  minutosActivos: 10,
  ultimaVez: null,
  valoracion: null,
  ingredientes: [{ ingredienteId: "salmon", cantidadPorRacion: 130, opcional: false }],
  ...extra,
});
const dia = (extra: Partial<DiaMenu> = {}): DiaMenu => ({
  fecha: "2026-11-04",
  minutosMax: 30,
  cole: { primero: "verdura", segundo: "carne", kcal: 503 },
  ...extra,
});
const base = { hoy: "2026-11-04", semana: {}, caducan: [], motivos: [] as const };

describe("explicarOpcion", () => {
  it("el resumen cuenta lo que comieron las niñas y por qué la cena lo compensa", () => {
    const e = explicarOpcion({ ...base, plato: plato(), dia: dia() });
    expect(e.resumen).toBe(
      "Hoy las niñas han comido verdura y carne en el cole; para compensar, Salmón a la plancha (pescado).",
    );
    expect(e.lineas[0]).toContain("tras carne de segundo, aconseja huevo y pescado");
  });

  it("conjuga según el día: pasado, hoy o futuro", () => {
    expect(
      explicarOpcion({ ...base, plato: plato(), dia: dia({ fecha: "2026-11-03" }) }).resumen,
    ).toContain("Ese día las niñas comieron");
    expect(
      explicarOpcion({ ...base, plato: plato(), dia: dia({ fecha: "2026-11-06" }) }).resumen,
    ).toContain("comerán");
  });

  it("explica el equilibrio semanal: falta, bien o completo", () => {
    const falta = explicarOpcion({ ...base, plato: plato(), dia: dia(), semana: { pescado: 0 } });
    expect(falta.lineas.join(" ")).toContain("llevan 0 de pescado");
    expect(falta.lineas.join(" ")).toContain("ayuda a llegar");
    const bien = explicarOpcion({ ...base, plato: plato(), dia: dia(), semana: { pescado: 2 } });
    expect(bien.lineas.join(" ")).toContain("con esta serían 3");
    const lleno = explicarOpcion({ ...base, plato: plato(), dia: dia(), semana: { pescado: 4 } });
    expect(lleno.lineas.join(" ")).toContain("Ojo: ya llevan 4 de pescado");
  });

  it("compensa el exceso o la ligereza del cole con las calorías", () => {
    const pesado = dia({ cole: { primero: "pasta", segundo: "huevo", kcal: 838 } });
    expect(explicarOpcion({ ...base, plato: plato(), dia: pesado }).lineas.join(" ")).toContain(
      "contundente (838 kcal)",
    );
    const ligero = dia({ cole: { primero: "verdura", segundo: "pescado", kcal: 500 } });
    expect(
      explicarOpcion({
        ...base,
        plato: plato({ grupo: "carne", nombre: "Filete" }),
        dia: ligero,
      }).lineas.join(" "),
    ).toContain("ligero (500 kcal)");
  });

  it("sin menú del cole usa la mejor razón disponible (equilibrio, prisas, caducidad, gusto)", () => {
    const sinCole = dia({ cole: null });
    expect(
      explicarOpcion({ ...base, plato: plato(), dia: sinCole, semana: { pescado: 0 } }).resumen,
    ).toContain("os falta pescado");
    expect(
      explicarOpcion({
        ...base,
        plato: plato({ grupo: "otro" }),
        dia: dia({ cole: null, minutosMax: 15 }),
      }).resumen,
    ).toContain("día de prisas");
    const caduca = explicarOpcion({
      ...base,
      plato: plato({ grupo: "otro" }),
      dia: sinCole,
      motivos: ["usa_caducidad"],
      caducan: [{ nombre: "Salmón", caducaEn: "2026-11-05" }],
    });
    expect(caduca.resumen).toBe("Gasta Salmón antes de que se estropee.");
    expect(caduca.lineas.join(" ")).toContain("caduca mañana");
    const gusto = explicarOpcion({
      ...base,
      plato: plato({ grupo: "otro", valoracion: 4.5 }),
      dia: sinCole,
      motivos: ["bien_valorado"],
    });
    expect(gusto.resumen).toContain("más os gustan");
    expect(gusto.lineas.join(" ")).toContain("★ 4,5");
  });

  it("añade despensa, novedad y tiempo sin ver cole", () => {
    const e = explicarOpcion({
      ...base,
      plato: plato({ grupo: "otro", ultimaVez: "2026-10-10" }),
      dia: dia({ cole: null }),
      motivos: ["usa_despensa", "hace_tiempo", "novedad"],
    });
    expect(e.lineas.join(" ")).toContain("Ya tenéis en casa");
    expect(e.lineas.join(" ")).toContain("Hace 25 días");
    expect(e.lineas.join(" ")).toContain("Aún no lo habéis cenado");
    expect(e.resumen).toBe("Salmón a la plancha es una buena opción para ese día.");
  });
});

describe("regla de oro y postre", () => {
  it("indica cómo completar la cena y el postre del cole", () => {
    const e = explicarOpcion({ ...base, plato: plato(), dia: dia(), faltan: ["hidrato", "grasa"] });
    const t = e.lineas.join(" ");
    expect(t).toContain("Para que sea una cena completa, añadid un hidrato");
    expect(t).toContain("una grasa saludable");
    expect(t).toContain("De postre, como aconseja el cole: fruta o un lácteo.");
  });

  it("si el plato ya es completo y no hay cole, no añade nada", () => {
    const e = explicarOpcion({
      ...base,
      plato: plato({ grupo: "otro" }),
      dia: dia({ cole: null }),
      faltan: [],
    });
    expect(e.lineas.join(" ")).not.toContain("completa");
    expect(e.lineas.join(" ")).not.toContain("postre");
  });
});

describe("equilibrio semanal", () => {
  it("cuenta cole y cenas de la semana, sin la cena del propio día", () => {
    const colegio = {
      "2026-11-03": { primero: "legumbre", segundo: "huevo" },
      "2026-11-05": { primero: "pasta", segundo: "legumbre" },
    } as const;
    const cenas = { "2026-11-04": "pescado", "2026-11-05": "huevo" } as const;
    const c = contarSemana("2026-11-04", colegio, cenas);
    expect(c).toMatchObject({ legumbre: 2, huevo: 2, pasta: 1 });
    expect(c.pescado).toBeUndefined(); // la cena del día no se cuenta
    expect(estadoDelGrupo("legumbre", c)?.estado).toBe("bien");
    expect(estadoDelGrupo("pescado", c)).toMatchObject({ estado: "falta", n: 0 });
    expect(estadoDelGrupo("verdura", c)).toBeNull(); // sin objetivo semanal
    expect(estadoDelGrupo("pescado", { pescado: 4 })?.estado).toBe("completo");
  });

  it("formatea listas en español", () => {
    expect(formatearLista([])).toBe("");
    expect(formatearLista(["a"])).toBe("a");
    expect(formatearLista(["a", "b", "a"])).toBe("a y b");
    expect(formatearLista(["a", "b", "c"])).toBe("a, b y c");
  });
});
