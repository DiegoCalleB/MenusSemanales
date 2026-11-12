import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "./datos-demo";
import { type Accion, type EstadoHogar, normalizar, reducir } from "./estado";

/** Qué llevar (D-136): añadir, editar, quitar y marcar como preparado. */
const aplicar = (e: EstadoHogar, ...a: Accion[]) => a.reduce(reducir, e);
const base = (): EstadoHogar => ({ ...estadoInicialDemo(), mochila: [] });

describe("qué llevar en el estado", () => {
  it("se apunta lo de cada día de la semana y no se duplica", () => {
    const anadir: Accion = {
      tipo: "mochila/anadir",
      personaId: "alba",
      texto: "  Carpeta   de piano ",
      dias: [2, 2],
      fecha: null,
      antes: 1,
    };
    const e = aplicar(base(), anadir);
    expect(e.mochila).toEqual([
      expect.objectContaining({ texto: "Carpeta de piano", dias: [2], fecha: null, antes: 1 }),
    ]);
    const otra = reducir(e, { ...anadir, texto: "carpeta de piano" });
    expect(otra.mochila).toHaveLength(1);
  });

  it("rechaza sin persona, sin texto, sin días o con antelación imposible", () => {
    const bien: Accion = {
      tipo: "mochila/anadir",
      personaId: "emma",
      texto: "Patines",
      dias: [5],
      fecha: null,
      antes: 1,
    };
    for (const mal of [
      { ...bien, personaId: "nadie" },
      { ...bien, texto: "   " },
      { ...bien, dias: [] },
      { ...bien, dias: [], fecha: "2026-04-31" },
      { ...bien, antes: 9 },
    ] as Accion[]) {
      const e = reducir(base(), mal);
      expect(e.aviso).toMatchObject({ tipo: "error" });
      expect(e.mochila).toEqual([]);
    }
  });

  it("un día suelto ignora los días de la semana; se edita, se marca y se quita", () => {
    let e = aplicar(base(), {
      tipo: "mochila/anadir",
      personaId: "emma",
      texto: "Disfraz",
      dias: [1],
      fecha: "2026-12-18",
      antes: 2,
    });
    const id = e.mochila[0]!.id;
    expect(e.mochila[0]).toMatchObject({ dias: [], fecha: "2026-12-18", antes: 2 });

    e = reducir(e, {
      tipo: "mochila/editar",
      id,
      personaId: "alba",
      texto: "Disfraz de pastora",
      dias: [5],
      fecha: null,
      antes: 1,
    });
    expect(e.mochila[0]).toMatchObject({ id, personaId: "alba", dias: [5], fecha: null });

    e = reducir(e, { tipo: "mochila/preparar", id, para: "2026-11-20" });
    expect(e.mochila[0]!.preparadas).toEqual(["2026-11-20"]);
    e = reducir(e, { tipo: "mochila/preparar", id, para: "2026-11-20" });
    expect(e.mochila[0]!.preparadas).toEqual([]);

    e = reducir(e, { tipo: "mochila/borrar", id });
    expect(e.mochila).toEqual([]);
  });

  it("un estado guardado antes de existir «qué llevar» se completa con la lista vacía", () => {
    const viejo: Partial<EstadoHogar> = { ...base() };
    delete viejo.mochila;
    expect(normalizar(viejo as EstadoHogar).mochila).toEqual([]);
  });
});
