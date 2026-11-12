import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "./datos-demo";
import { type Accion, type EstadoHogar, fechaApuntable, reducir } from "./estado";
import { diferencias } from "./tablas";
import { diferenciasMenu } from "./tablas-menu";

/**
 * Editar todo lo que se puede añadir (D-133): citas, cumpleaños, tareas de la casa, tareas de cada
 * persona y la comida del mediodía. Mismas reglas que al crearlos, y lo editado se manda a la nube
 * como un cambio de esa fila (no como borrar y crear).
 */
const HOGAR = "5f3d4e1a-6b7c-4d8e-9f0a-1b2c3d4e5f60";
const BASE = "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11";
const aplicar = (e: EstadoHogar, ...a: Accion[]) => a.reduce(reducir, e);
const base = (): EstadoHogar => estadoInicialDemo();
const rechazo = (antes: EstadoHogar, despues: EstadoHogar) => {
  expect(despues.aviso).toMatchObject({ tipo: "error" });
  return despues;
};

describe("editar una cita (agenda/editar)", () => {
  const con = (): EstadoHogar =>
    aplicar(base(), {
      tipo: "agenda/cita",
      titulo: "Dentista",
      fecha: "2026-12-10",
      hora: "10:00",
      idBase: BASE,
    });

  it("cambia el título, el día, el último día y la hora, y se manda como cambio", () => {
    const e = con();
    const id = e.agenda.at(-1)!.id;
    const d = reducir(e, {
      tipo: "agenda/editar",
      id,
      titulo: "  Dentista   de Alba ",
      fecha: "2026-12-12",
      hasta: "2026-12-14",
      hora: "",
    });
    expect(d.agenda.find((a) => a.id === id)).toEqual({
      id,
      titulo: "Dentista de Alba",
      fecha: "2026-12-12",
      hasta: "2026-12-14",
      hora: null,
    });
    expect(d.agenda).toHaveLength(e.agenda.length);
    const c = diferencias(e, d, HOGAR);
    expect(c?.agenda?.upsert).toHaveLength(1);
    expect(c?.agenda?.upsert?.[0]).toMatchObject({
      titulo: "Dentista de Alba",
      fecha: "2026-12-12",
    });
    expect(c?.agenda?.borrar ?? []).toHaveLength(0);
  });

  it("rechaza un título vacío, un día que no existe, una hora mala y un último día anterior", () => {
    const e = con();
    const id = e.agenda.at(-1)!.id;
    for (const cambio of [
      { titulo: "  ", fecha: "2026-12-10" },
      { titulo: "x".repeat(121), fecha: "2026-12-10" },
      { titulo: "Bien", fecha: "2026-04-31" },
      { titulo: "Bien", fecha: "2026-12-10", hora: "25:00" },
      { titulo: "Bien", fecha: "2026-12-10", hasta: "2026-12-10" },
      { titulo: "Bien", fecha: "2026-12-10", hasta: "2026-12-09" },
    ]) {
      const d = rechazo(e, reducir(e, { tipo: "agenda/editar", id, ...cambio }));
      expect(d.agenda).toEqual(e.agenda);
    }
    // Y una cita que no existe.
    rechazo(
      e,
      reducir(e, { tipo: "agenda/editar", id: "no-existe", titulo: "A", fecha: "2026-12-10" }),
    );
  });

  it("no deja dos citas iguales el mismo día", () => {
    let e = con();
    e = aplicar(e, {
      tipo: "agenda/cita",
      titulo: "Cole",
      fecha: "2026-12-10",
      idBase: BASE.replace("a11", "a12"),
    });
    const id = e.agenda.at(-1)!.id;
    const d = rechazo(
      e,
      reducir(e, { tipo: "agenda/editar", id, titulo: "dentista", fecha: "2026-12-10" }),
    );
    expect(d.agenda).toEqual(e.agenda);
    // Con otro título sí; y quedarse como está (mismo título y día) también vale.
    expect(
      reducir(e, { tipo: "agenda/editar", id, titulo: "Cole", fecha: "2026-12-10" }).aviso,
    ).toMatchObject({ tipo: "ok" });
  });
});

describe("editar un cumpleaños (cumple/editar)", () => {
  const e0 = aplicar(
    base(),
    { tipo: "cumple/anadir", nombre: "Lucía", dia: 10, mes: 3, relacion: "amigo", idBase: BASE },
    {
      tipo: "cumple/anadir",
      nombre: "Pablo",
      dia: 5,
      mes: 7,
      anio: 2015,
      relacion: "cole",
      idBase: BASE.replace("a11", "a21"),
    },
  );
  const c0 = e0.cumples.find((c) => c.nombre === "Lucía")!;
  const c1 = e0.cumples.find((c) => c.nombre === "Pablo")!;

  it("cambia nombre, día, mes, año y relación sin perder las ideas ni el estado del regalo", () => {
    const conIdea = aplicar(e0, { tipo: "cumple/idea", id: c0.id, texto: "Libro" });
    const d = reducir(conIdea, {
      tipo: "cumple/editar",
      id: c0.id,
      nombre: "  Lucía   Pérez ",
      dia: 29,
      mes: 2,
      anio: 1990,
      relacion: "familia",
    });
    const nuevo = d.cumples.find((c) => c.id === c0.id)!;
    expect(nuevo).toMatchObject({
      nombre: "Lucía Pérez",
      dia: 29,
      mes: 2,
      anio: 1990,
      relacion: "familia",
    });
    expect(nuevo.ideas).toEqual(["Libro"]);
    expect(nuevo.estado).toBe(conIdea.cumples.find((c) => c.id === c0.id)!.estado);
    expect(d.cumples).toHaveLength(conIdea.cumples.length);
    expect(diferencias(conIdea, d, HOGAR)?.cumples?.upsert).toHaveLength(1);
  });

  it("rechaza días y meses que no existen, el año de otra época y los nombres vacíos", () => {
    for (const cambio of [
      { nombre: "", dia: 1, mes: 1 },
      { nombre: "A", dia: 30, mes: 2 },
      { nombre: "A", dia: 31, mes: 4 },
      { nombre: "A", dia: 1, mes: 13 },
      { nombre: "A", dia: 0, mes: 1 },
      { nombre: "A", dia: 1, mes: 1, anio: 1800 },
      { nombre: "A", dia: 1, mes: 1, anio: Number(e0.hoy.slice(0, 4)) + 1 },
    ]) {
      const d = rechazo(
        e0,
        reducir(e0, { tipo: "cumple/editar", id: c0.id, relacion: "familia", ...cambio }),
      );
      expect(d.cumples).toEqual(e0.cumples);
    }
  });

  it("no deja dos cumpleaños iguales (mismo nombre y día)", () => {
    const d = rechazo(
      e0,
      reducir(e0, {
        tipo: "cumple/editar",
        id: c1.id,
        nombre: "lucía",
        dia: c0.dia,
        mes: c0.mes,
        relacion: c1.relacion,
      }),
    );
    expect(d.cumples).toEqual(e0.cumples);
  });

  it("si el nombre pasa a ser el de una persona del hogar, se liga a ella", () => {
    const persona = e0.personas.find((p) => p.activa)!;
    expect(c0.personaId ?? null).toBeNull();
    const d = reducir(e0, {
      tipo: "cumple/editar",
      id: c0.id,
      nombre: persona.nombre,
      dia: c0.dia,
      mes: c0.mes,
      relacion: "familia",
    });
    expect(d.cumples.find((c) => c.id === c0.id)!.personaId).toBe(persona.id);
  });
});

describe("editar una tarea de la casa (casa/editar)", () => {
  const con = (): EstadoHogar =>
    aplicar(base(), {
      tipo: "casa/anadir",
      titulo: "Cambiar sábanas",
      cadaDias: 14,
      responsableId: null,
      idBase: BASE,
    });

  it("cambia qué es, cada cuántos días y el dibujo, y se manda como cambio", () => {
    const e = con();
    const id = e.casa.at(-1)!.id;
    const d = reducir(e, {
      tipo: "casa/editar",
      id,
      titulo: "Cambiar las sábanas",
      cadaDias: 7,
      emoji: "🛏️",
    });
    expect(d.casa.find((t) => t.id === id)).toMatchObject({
      titulo: "Cambiar las sábanas",
      cadaDias: 7,
      emoji: "🛏️",
    });
    // No toca lo que no se edita: cuándo se hizo por última vez.
    expect(d.casa.find((t) => t.id === id)!.ultimaVez).toBe(
      e.casa.find((t) => t.id === id)!.ultimaVez,
    );
    expect(diferencias(e, d, HOGAR)?.casa?.upsert).toHaveLength(1);
  });

  it("rechaza lo vacío, menos de 1 día, más de 3650 y un título repetido", () => {
    let e = con();
    e = aplicar(e, {
      tipo: "casa/anadir",
      titulo: "Pasar la fregona",
      cadaDias: 3,
      responsableId: null,
      idBase: BASE.replace("a11", "a13"),
    });
    const id = e.casa.at(-1)!.id;
    for (const cambio of [
      { titulo: " ", cadaDias: 3 },
      { titulo: "Bien", cadaDias: 0 },
      { titulo: "Bien", cadaDias: 3651 },
      { titulo: "cambiar sábanas", cadaDias: 3 },
      { titulo: "Bien", cadaDias: 3, emoji: "" },
    ]) {
      const d = rechazo(e, reducir(e, { tipo: "casa/editar", id, ...cambio }));
      expect(d.casa).toEqual(e.casa);
    }
  });
});

describe("editar una tarea de una persona (tarea/editar)", () => {
  const persona = base().personas.find((p) => p.activa)!;
  const otra = base().personas.filter((p) => p.activa)[1]!;
  const con = (): EstadoHogar =>
    aplicar(base(), {
      tipo: "tarea/anadir",
      personaId: persona.id,
      texto: "Sacar la basura",
      frecuencia: "diaria",
      idBase: BASE,
    });

  it("cambia el texto y a quién le toca, y se manda como cambio", () => {
    const e = con();
    const t = e.tareas.at(-1)!;
    const d = reducir(e, {
      tipo: "tarea/editar",
      id: t.id,
      texto: "Bajar la basura",
      frecuencia: "diaria",
      personaId: otra.id,
    });
    expect(d.tareas.find((x) => x.id === t.id)).toMatchObject({
      texto: "Bajar la basura",
      personaId: otra.id,
    });
    expect(diferencias(e, d, HOGAR)?.tareas?.upsert).toHaveLength(1);
  });

  it("al pasar de «cada día» a «una vez» lo hecho deja de valer (y se conserva si no cambia)", () => {
    let e = con();
    const t = e.tareas.at(-1)!;
    e = aplicar(e, { tipo: "tarea/alternar", id: t.id });
    expect(e.tareas.find((x) => x.id === t.id)!.hechas.length).toBe(1);
    const igual = reducir(e, {
      tipo: "tarea/editar",
      id: t.id,
      texto: "Sacar la basura ya",
      frecuencia: "diaria",
    });
    expect(igual.tareas.find((x) => x.id === t.id)!.hechas).toEqual(
      e.tareas.find((x) => x.id === t.id)!.hechas,
    );
    const cambia = reducir(e, {
      tipo: "tarea/editar",
      id: t.id,
      texto: "Sacar la basura",
      frecuencia: "puntual",
    });
    expect(cambia.tareas.find((x) => x.id === t.id)!.hechas).toEqual([]);
  });

  it("rechaza lo vacío, una persona que no existe y una tarea repetida", () => {
    let e = con();
    e = aplicar(e, {
      tipo: "tarea/anadir",
      personaId: persona.id,
      texto: "Regar",
      frecuencia: "diaria",
      idBase: BASE.replace("a11", "a14"),
    });
    const t = e.tareas.at(-1)!;
    for (const cambio of [
      { texto: " ", frecuencia: "diaria" as const },
      { texto: "Bien", frecuencia: "diaria" as const, personaId: "no-existe" },
      { texto: "sacar la basura", frecuencia: "diaria" as const },
    ]) {
      const d = rechazo(e, reducir(e, { tipo: "tarea/editar", id: t.id, ...cambio }));
      expect(d.tareas).toEqual(e.tareas);
    }
  });
});

describe("editar la comida del mediodía (almuerzo/editar)", () => {
  const e0 = base();
  const hoy = e0.hoy;
  const plato = e0.platos.find((p) => !p.noProponer)!;
  const con = (): EstadoHogar =>
    aplicar(e0, { tipo: "almuerzo/anadir", fecha: hoy, texto: "Restaurante", idBase: BASE });

  it("cambia el día y qué se come: un plato del catálogo o un texto libre", () => {
    const e = con();
    const id = e.almuerzos.at(-1)!.id;
    const conPlato = reducir(e, { tipo: "almuerzo/editar", id, fecha: hoy, platoId: plato.id });
    expect(conPlato.almuerzos.find((a) => a.id === id)).toMatchObject({
      texto: plato.nombre,
      platoId: plato.id,
    });
    const libre = reducir(conPlato, {
      tipo: "almuerzo/editar",
      id,
      fecha: hoy,
      texto: "En casa de los abuelos",
    });
    expect(libre.almuerzos.find((a) => a.id === id)).toMatchObject({
      texto: "En casa de los abuelos",
      platoId: null,
    });
    expect(diferenciasMenu(e, libre, HOGAR)?.almuerzos?.upsert).toHaveLength(1);
  });

  it("rechaza lo vacío, un plato que no existe, un día fuera de plazo y lo repetido", () => {
    let e = con();
    e = aplicar(e, {
      tipo: "almuerzo/anadir",
      fecha: hoy,
      texto: "Paella",
      idBase: BASE.replace("a11", "a15"),
    });
    const id = e.almuerzos.at(-1)!.id;
    expect(fechaApuntable(e, "2020-01-01")).toBe(false);
    for (const cambio of [
      { fecha: hoy, texto: " " },
      { fecha: hoy, platoId: "no-existe" },
      { fecha: "2020-01-01", texto: "Ayer" },
      { fecha: hoy, texto: "restaurante" },
    ]) {
      const d = rechazo(e, reducir(e, { tipo: "almuerzo/editar", id, ...cambio }));
      expect(d.almuerzos).toEqual(e.almuerzos);
    }
  });
});
