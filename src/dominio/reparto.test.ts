import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calcularReparto, proponerRotacion } from "./reparto";
import type { Carga, Persona, Turno } from "./tipos";

const SEMANA = { desde: "2026-11-02", hasta: "2026-11-08" };
const persona = (id: string, extra: Partial<Persona> = {}): Persona => ({
  id,
  nombre: id,
  tipo: "adulto",
  activa: true,
  factorRacion: 1,
  ...extra,
});
const carga = (id: string, esfuerzoMin: number, extra: Partial<Carga> = {}): Carga => ({
  id,
  nombre: id,
  tipo: "tarea",
  esfuerzoMin,
  planificacionMin: 0,
  responsableId: null,
  activa: true,
  ...extra,
});
const turno = (
  cargaId: string,
  fecha: string,
  personaId: string,
  estado: Turno["estado"] = "pendiente",
): Turno => ({
  cargaId,
  fecha,
  personaId,
  estado,
});

const diego = persona("diego");
const ana = persona("ana");
const nina = persona("alba", { tipo: "nino", factorRacion: 0.5 });

describe("calcularReparto", () => {
  it("cuenta la ejecución de los turnos de la semana", () => {
    const r = calcularReparto({
      personas: [diego, ana],
      cargas: [carga("cenas", 40)],
      turnos: [
        turno("cenas", "2026-11-03", "diego"),
        turno("cenas", "2026-11-04", "diego"),
        turno("cenas", "2026-11-05", "ana"),
      ],
      semana: SEMANA,
    });
    expect(r.personas).toEqual([
      { personaId: "diego", ejecucionMin: 80, planificacionMin: 0, totalMin: 80, porcentaje: 66.7 },
      { personaId: "ana", ejecucionMin: 40, planificacionMin: 0, totalMin: 40, porcentaje: 33.3 },
    ]);
    expect(r.totalMin).toBe(120);
    expect(r.diferenciaPuntos).toBe(33.4);
  });

  it("el trabajo invisible de planificar cuenta: es lo que suele pasar desapercibido", () => {
    // Diego cocina las cenas; Ana es responsable de todo (acordarse, decidir, organizar).
    const cargas = [
      carga("cenas", 40, { planificacionMin: 20, responsableId: "ana" }),
      carga("compra", 60, { planificacionMin: 45, responsableId: "ana" }),
    ];
    const turnos = [
      turno("cenas", "2026-11-03", "diego"),
      turno("cenas", "2026-11-04", "diego"),
      turno("compra", "2026-11-07", "diego"),
    ];
    const soloEjecucion = calcularReparto({
      personas: [diego, ana],
      cargas: cargas.map((c) => ({ ...c, planificacionMin: 0 })),
      turnos,
      semana: SEMANA,
    });
    const conPlanificacion = calcularReparto({
      personas: [diego, ana],
      cargas,
      turnos,
      semana: SEMANA,
    });

    // Mirando solo quién ejecuta, parece que todo lo hace Diego...
    expect(soloEjecucion.personas.find((p) => p.personaId === "ana")?.totalMin).toBe(0);
    // ...pero al contar el trabajo invisible, Ana carga con 65 minutos que antes no se veían.
    expect(conPlanificacion.personas.find((p) => p.personaId === "ana")).toMatchObject({
      planificacionMin: 65,
      totalMin: 65,
    });
    expect(conPlanificacion.diferenciaPuntos).toBeLessThan(soloEjecucion.diferenciaPuntos);
  });

  it("ignora turnos saltados, de otra semana, de cargas inactivas y de quien no es adulto activo", () => {
    const r = calcularReparto({
      personas: [diego, ana, nina, persona("abuelo", { activa: false })],
      cargas: [carga("a", 10), carga("b", 10, { activa: false })],
      turnos: [
        turno("a", "2026-11-03", "diego", "saltado"),
        turno("a", "2026-11-09", "diego"), // semana siguiente
        turno("b", "2026-11-03", "diego"), // carga inactiva
        turno("a", "2026-11-03", "alba"), // no es adulta
        turno("a", "2026-11-03", "abuelo"), // inactivo
        turno("desconocida", "2026-11-03", "diego"),
        turno("a", "2026-11-03", "ana", "hecho"),
      ],
      semana: SEMANA,
    });
    expect(r.personas.map((p) => [p.personaId, p.totalMin])).toEqual([
      ["diego", 0],
      ["ana", 10],
    ]);
  });

  it("lista las cargas sin responsable adulto activo", () => {
    const r = calcularReparto({
      personas: [diego, nina],
      cargas: [
        carga("huerfana", 10),
        carga("de-una-niña", 10, { responsableId: "alba" }),
        carga("ok", 10, { responsableId: "diego" }),
        carga("inactiva", 10, { activa: false }),
      ],
      turnos: [],
      semana: SEMANA,
    });
    expect(r.sinResponsable.map((c) => c.id)).toEqual(["huerfana", "de-una-niña"]);
  });

  it("sin carga no hay porcentajes ni diferencia; con una sola persona la diferencia es 0", () => {
    const vacio = calcularReparto({
      personas: [diego, ana],
      cargas: [],
      turnos: [],
      semana: SEMANA,
    });
    expect(vacio.personas.every((p) => p.porcentaje === 0)).toBe(true);
    expect(vacio.diferenciaPuntos).toBe(0);
    const sola = calcularReparto({
      personas: [diego],
      cargas: [carga("a", 30)],
      turnos: [turno("a", "2026-11-03", "diego")],
      semana: SEMANA,
    });
    expect(sola.diferenciaPuntos).toBe(0);
    expect(sola.personas[0]?.porcentaje).toBe(100);
  });
});

describe("proponerRotacion", () => {
  const cargas = [carga("cenas", 40), carga("compra", 60)];

  it("reparte para igualar los minutos totales", () => {
    const { turnos, sinAsignar } = proponerRotacion({
      personas: [diego, ana],
      cargas,
      ocurrencias: [
        { cargaId: "cenas", fecha: "2026-11-03" },
        { cargaId: "cenas", fecha: "2026-11-04" },
        { cargaId: "cenas", fecha: "2026-11-05" },
        { cargaId: "compra", fecha: "2026-11-07" },
      ],
    });
    expect(sinAsignar).toEqual([]);
    const r = calcularReparto({ personas: [diego, ana], cargas, turnos, semana: SEMANA });
    // 3 cenas de 40 min y una compra de 60 min: el mejor reparto posible es 100/80 (11,2 puntos).
    expect(r.diferenciaPuntos).toBeLessThanOrEqual(11.2);
  });

  it("tiene en cuenta el trabajo de planificación y los turnos que ya había", () => {
    const conResponsable = [
      carga("cenas", 40, { planificacionMin: 120, responsableId: "ana" }),
      carga("compra", 60),
    ];
    const { turnos } = proponerRotacion({
      personas: [diego, ana],
      cargas: conResponsable,
      ocurrencias: [{ cargaId: "cenas", fecha: "2026-11-03" }],
    });
    // Ana ya carga con 120 min de planificación: la cena le toca a Diego.
    expect(turnos).toEqual([
      { cargaId: "cenas", fecha: "2026-11-03", personaId: "diego", estado: "pendiente" },
    ]);

    const { turnos: t2 } = proponerRotacion({
      personas: [diego, ana],
      cargas,
      ocurrencias: [{ cargaId: "cenas", fecha: "2026-11-03" }],
      turnosExistentes: [
        turno("compra", "2026-11-02", "diego"),
        turno("compra", "2026-11-09", "ana", "saltado"),
      ],
    });
    expect(t2[0]?.personaId).toBe("ana");
  });

  it("respeta a quien no está disponible y avisa de lo que nadie puede hacer", () => {
    const { turnos, sinAsignar } = proponerRotacion({
      personas: [diego, ana],
      cargas,
      ocurrencias: [
        { cargaId: "cenas", fecha: "2026-11-03" },
        { cargaId: "cenas", fecha: "2026-11-04" },
      ],
      noDisponible: [
        { personaId: "diego", fecha: "2026-11-03" },
        { personaId: "diego", fecha: "2026-11-04" },
        { personaId: "ana", fecha: "2026-11-04" },
      ],
    });
    expect(turnos).toEqual([
      { cargaId: "cenas", fecha: "2026-11-03", personaId: "ana", estado: "pendiente" },
    ]);
    expect(sinAsignar).toEqual([{ cargaId: "cenas", fecha: "2026-11-04" }]);
  });

  it("a igual carga, gana quien es responsable de esa carga", () => {
    const { turnos } = proponerRotacion({
      personas: [diego, ana],
      cargas: [carga("cenas", 40, { responsableId: "ana" })],
      ocurrencias: [{ cargaId: "cenas", fecha: "2026-11-03" }],
    });
    expect(turnos[0]?.personaId).toBe("ana");
  });

  it("ignora las cargas inactivas, a los niños y a los adultos inactivos", () => {
    const { turnos } = proponerRotacion({
      personas: [nina, persona("abuelo", { activa: false }), ana],
      cargas: [carga("a", 10), carga("b", 10, { activa: false })],
      ocurrencias: [
        { cargaId: "a", fecha: "2026-11-03" },
        { cargaId: "b", fecha: "2026-11-03" },
      ],
    });
    expect(turnos).toEqual([
      { cargaId: "a", fecha: "2026-11-03", personaId: "ana", estado: "pendiente" },
    ]);
  });

  it("sin ninguna persona adulta todo queda sin asignar", () => {
    const { turnos, sinAsignar } = proponerRotacion({
      personas: [nina],
      cargas: [carga("a", 10)],
      ocurrencias: [{ cargaId: "a", fecha: "2026-11-03" }],
    });
    expect(turnos).toEqual([]);
    expect(sinAsignar).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
const arbPersonas = fc
  .uniqueArray(fc.constantFrom("p1", "p2", "p3"), { minLength: 1 })
  .map((ids) => ids.map((id) => persona(id)));
const arbCargas = fc.uniqueArray(
  fc.record({
    id: fc.constantFrom("c1", "c2", "c3", "c4"),
    esfuerzo: fc.integer({ min: 5, max: 120 }),
  }),
  { selector: (c) => c.id, minLength: 1 },
);
const fechas = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];

describe("propiedades del reparto", () => {
  it("los minutos de las personas suman el total y los porcentajes suman ~100", () => {
    fc.assert(
      fc.property(
        arbPersonas,
        arbCargas,
        fc.array(
          fc.tuple(
            fc.constantFrom(...fechas),
            fc.constantFrom("p1", "p2", "p3"),
            fc.constantFrom("c1", "c2", "c3", "c4"),
          ),
          { maxLength: 15 },
        ),
        (personas, cs, ts) => {
          const cargas = cs.map((c) =>
            carga(c.id, c.esfuerzo, {
              planificacionMin: 10,
              responsableId: personas[0]?.id ?? null,
            }),
          );
          const turnos = ts.map(([f, p, c]) => turno(c, f, p));
          const r = calcularReparto({ personas, cargas, turnos, semana: SEMANA });
          expect(r.personas.reduce((s, p) => s + p.totalMin, 0)).toBe(r.totalMin);
          if (r.totalMin > 0) {
            expect(Math.abs(r.personas.reduce((s, p) => s + p.porcentaje, 0) - 100)).toBeLessThan(
              0.1 * personas.length + 0.001,
            );
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("cada ocurrencia se asigna una sola vez, a alguien disponible, y es independiente del orden de entrada", () => {
    fc.assert(
      fc.property(
        arbPersonas,
        arbCargas,
        fc.uniqueArray(
          fc.tuple(fc.constantFrom("c1", "c2", "c3", "c4"), fc.constantFrom(...fechas)),
          { selector: ([c, f]) => `${c}|${f}`, maxLength: 12 },
        ),
        fc.array(fc.tuple(fc.constantFrom("p1", "p2", "p3"), fc.constantFrom(...fechas)), {
          maxLength: 4,
        }),
        (personas, cs, oc, nd) => {
          const cargas = cs.map((c) => carga(c.id, c.esfuerzo));
          const ocurrencias = oc.map(([cargaId, fecha]) => ({ cargaId, fecha }));
          const noDisponible = nd.map(([personaId, fecha]) => ({ personaId, fecha }));
          const a = proponerRotacion({ personas, cargas, ocurrencias, noDisponible });
          const b = proponerRotacion({
            personas,
            cargas,
            ocurrencias: [...ocurrencias].reverse(),
            noDisponible,
          });
          expect(a).toEqual(b);

          const activas = new Set(cargas.map((c) => c.id));
          const esperadas = ocurrencias.filter((o) => activas.has(o.cargaId)).length;
          expect(a.turnos.length + a.sinAsignar.length).toBe(esperadas);
          const claves = a.turnos.map((t) => `${t.cargaId}|${t.fecha}`);
          expect(new Set(claves).size).toBe(claves.length);
          for (const t of a.turnos) {
            expect(
              noDisponible.some((n) => n.personaId === t.personaId && n.fecha === t.fecha),
            ).toBe(false);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("con todos disponibles y sin carga previa, la diferencia nunca supera la ocurrencia más pesada", () => {
    fc.assert(
      fc.property(
        arbPersonas,
        arbCargas,
        fc.uniqueArray(
          fc.tuple(fc.constantFrom("c1", "c2", "c3", "c4"), fc.constantFrom(...fechas)),
          { selector: ([c, f]) => `${c}|${f}`, minLength: 1, maxLength: 16 },
        ),
        (personas, cs, oc) => {
          const cargas = cs.map((c) => carga(c.id, c.esfuerzo));
          const activas = new Set(cargas.map((c) => c.id));
          const ocurrencias = oc
            .map(([cargaId, fecha]) => ({ cargaId, fecha }))
            .filter((o) => activas.has(o.cargaId));
          const { turnos } = proponerRotacion({ personas, cargas, ocurrencias });
          const minutos = new Map(personas.map((p) => [p.id, 0]));
          const esfuerzo = new Map(cargas.map((c) => [c.id, c.esfuerzoMin]));
          for (const t of turnos)
            minutos.set(
              t.personaId,
              (minutos.get(t.personaId) ?? 0) + (esfuerzo.get(t.cargaId) ?? 0),
            );
          const valores = [...minutos.values()];
          const maxEsfuerzo = Math.max(0, ...cargas.map((c) => c.esfuerzoMin));
          expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(maxEsfuerzo);
        },
      ),
      { numRuns: 300 },
    );
  });
});
