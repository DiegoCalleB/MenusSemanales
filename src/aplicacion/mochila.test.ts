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

describe("calendario escolar en el estado (D-144)", () => {
  const e0 = (): EstadoHogar => ({ ...base(), diasCole: [] });

  it("lo nuevo es del cole salvo que se diga; lo antiguo sin el campo, también", () => {
    const e = aplicar(e0(), {
      tipo: "mochila/anadir",
      personaId: "alba",
      texto: "Piano",
      dias: [2],
      fecha: null,
      antes: 1,
    });
    expect(e.mochila[0]?.soloConCole).toBe(true);
    const { id, personaId, texto, dias, fecha, antes } = e.mochila[0]!;
    const editar = { tipo: "mochila/editar" as const, id, personaId, texto, dias, fecha, antes };
    const f = reducir(e, { ...editar, soloConCole: false });
    expect(f.mochila[0]?.soloConCole).toBe(false);
    // Editar sin decirlo conserva lo que había.
    expect(reducir(f, editar).mochila[0]?.soloConCole).toBe(false);
    const viejo = {
      ...e0(),
      mochila: [{ ...e.mochila[0]!, soloConCole: undefined }],
    } as unknown as EstadoHogar;
    expect(normalizar(viejo).mochila[0]?.soloConCole).toBe(true);
    const sinDias: Partial<EstadoHogar> = { ...e0() };
    delete sinDias.diasCole;
    expect(normalizar(sinDias as EstadoHogar).diasCole).toEqual([]);
  });

  it("apunta días sin cole y «sí hay cole», y vuelve a lo oficial", () => {
    let e = reducir(e0(), {
      tipo: "cole/dia",
      fecha: "2026-11-24",
      hay: false,
      motivo: "  Libre ",
    });
    expect(e.diasCole).toEqual([{ fecha: "2026-11-24", hay: false, motivo: "Libre" }]);
    e = reducir(e, { tipo: "cole/dia", fecha: "2026-12-08", hay: true });
    expect(e.diasCole.map((a) => a.fecha)).toEqual(["2026-11-24", "2026-12-08"]);
    // Volver a decir que ese día sí hay cole lo cambia, no lo duplica.
    e = reducir(e, { tipo: "cole/dia", fecha: "2026-11-24", hay: true });
    expect(e.diasCole.map((a) => a.fecha)).toEqual(["2026-12-08"]);
    e = reducir(e, { tipo: "cole/oficial", fecha: "2026-12-08" });
    expect(e.diasCole).toEqual([]);
  });

  it("no apunta lo que ya dice el calendario oficial", () => {
    const e = reducir(e0(), { tipo: "cole/dia", fecha: "2026-12-08", hay: false });
    expect(e.diasCole).toEqual([]);
    expect(reducir(e0(), { tipo: "cole/dia", fecha: "2026-11-24", hay: true }).diasCole).toEqual(
      [],
    );
  });

  it("rechaza fines de semana, días que no existen y motivos larguísimos", () => {
    for (const a of [
      { tipo: "cole/dia", fecha: "2026-11-21", hay: false },
      { tipo: "cole/dia", fecha: "2026-02-30", hay: false },
      { tipo: "cole/dia", fecha: "", hay: false },
      { tipo: "cole/dia", fecha: "2026-11-24", hay: false, motivo: "x".repeat(61) },
    ] as Accion[]) {
      const e = reducir(e0(), a);
      expect(e.aviso).toMatchObject({ tipo: "error" });
      expect(e.diasCole).toEqual([]);
    }
  });
});
