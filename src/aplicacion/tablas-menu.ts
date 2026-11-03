import { z } from "zod";
import { esUuid } from "@/dominio/identificadores";
import type { FechaIso } from "@/dominio/fechas";
import { GRUPOS_PLATO, type PlatoMenu } from "@/dominio/menu";
import { redondear } from "@/dominio/numeros";
import { SECCIONES, type ComidaPlanificada, type Ingrediente } from "@/dominio/tipos";
import { type EstadoHogar, nombreDia } from "./estado";
import { aUuid } from "./tablas";

/**
 * Puente entre el estado de la app y las tablas del MENÚ (D-101): platos con sus ingredientes,
 * cenas (varios platos en orden), notas, comidas del mediodía, valoraciones y exclusiones. Es PURO:
 * no habla con la red. Mismo esquema que `tablas.ts`: leer, calcular diferencias por identificador
 * y mezclar cambios.
 *
 * Los ingredientes son un catálogo compartido (único por nombre): sus ids no se derivan, se
 * RESUELVEN por nombre en la base de datos (`resolver_ingredientes`). Los platos sí: `aUuid`.
 */

const SECCION_VALIDA = new Set<string>(SECCIONES);

// --------------------------------------------------------------------------------------------
// Formas de los cambios (lo que entiende `aplicar_cambios_menu`)
// --------------------------------------------------------------------------------------------

export interface FilaIngredientePlato {
  ingredienteId: string;
  cantidadPorRacion: number;
  opcional: boolean;
}

export interface FilaPlato {
  id: string;
  nombre: string;
  ligero: boolean;
  grupo: PlatoMenu["grupo"];
  minutosActivos: number;
  pasos: string | null;
  noProponer: boolean;
  porRevisar: boolean;
  ultimaVez: FechaIso | null;
  ingredientes: FilaIngredientePlato[];
}

export interface FilaComida {
  fecha: FechaIso;
  momento: "cena";
  raciones: number;
  estado: "planificada";
  platos: string[];
}

export interface FilaNota {
  fecha: FechaIso;
  momento: "cena";
  texto: string;
}

export interface FilaAlmuerzo {
  id: string;
  fecha: FechaIso;
  texto: string;
  platoId: string | null;
}

export interface FilaValoracion {
  platoId: string;
  personaId: string;
  puntos: number;
}

interface Grupo<T, B = string> {
  upsert?: T[];
  borrar?: B[];
}

export interface CambiosMenu {
  platos?: Grupo<FilaPlato>;
  excluidos?: Grupo<string>;
  comidas?: Grupo<FilaComida>;
  notas?: Grupo<FilaNota>;
  almuerzos?: Grupo<FilaAlmuerzo>;
  valoraciones?: Grupo<FilaValoracion>;
}

// --------------------------------------------------------------------------------------------
// Lectura (lo que devuelve `leer_menu_tablas`)
// --------------------------------------------------------------------------------------------

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

export const lecturaMenuSchema = z.object({
  ingredientes: z.array(
    z.object({
      id: uuid,
      nombre: z.string().min(1),
      unidad: z.enum(["g", "ml", "ud"]),
      seccion: z.string(),
    }),
  ),
  platos: z.array(
    z.object({
      id: uuid,
      nombre: z.string().min(1),
      grupo: z.enum(GRUPOS_PLATO),
      ligero: z.boolean(),
      minutosActivos: z.number().int().min(1).max(480).nullable(),
      pasos: z.string().nullable(),
      noProponer: z.boolean(),
      porRevisar: z.boolean(),
      ultimaVez: fechaIso.nullable(),
      ingredientes: z.array(
        z.object({
          ingredienteId: uuid,
          cantidadPorRacion: z.number().positive(),
          opcional: z.boolean(),
        }),
      ),
    }),
  ),
  excluidos: z.array(uuid),
  comidas: z.array(
    z.object({
      fecha: fechaIso,
      momento: z.enum(["comida", "cena"]),
      raciones: z.number().positive(),
      estado: z.string(),
      platos: z.array(uuid),
    }),
  ),
  notas: z.array(
    z.object({ fecha: fechaIso, momento: z.enum(["comida", "cena"]), texto: z.string() }),
  ),
  almuerzos: z.array(
    z.object({ id: uuid, fecha: fechaIso, texto: z.string(), platoId: uuid.nullable() }),
  ),
  valoraciones: z.array(
    z.object({ platoId: uuid, personaId: uuid, puntos: z.number().int().min(1).max(5) }),
  ),
});
export type LecturaMenu = z.infer<typeof lecturaMenuSchema>;

export const leerMenu = (json: unknown): LecturaMenu => lecturaMenuSchema.parse(json);

/** ¿Ya hay un menú en tablas? (Sin platos no se ha llevado nada: sigue mandando el documento.) */
export const hayMenuEnTablas = (l: LecturaMenu): boolean => l.platos.length > 0;

// --------------------------------------------------------------------------------------------
// Estado → filas
// --------------------------------------------------------------------------------------------

const ordenIngredientes = (a: FilaIngredientePlato, b: FilaIngredientePlato) =>
  Number(a.opcional) - Number(b.opcional) || a.ingredienteId.localeCompare(b.ingredienteId);

function filaPlato(h: string, p: PlatoMenu): FilaPlato {
  return {
    id: aUuid(h, p.id),
    nombre: p.nombre,
    ligero: p.ligero === true,
    grupo: p.grupo,
    minutosActivos: p.minutosActivos,
    pasos: p.pasos ?? null,
    noProponer: p.noProponer === true,
    porRevisar: p.porRevisar === true,
    ultimaVez: p.ultimaVez,
    ingredientes: p.ingredientes
      .map((i) => ({
        ingredienteId: i.ingredienteId,
        cantidadPorRacion: i.cantidadPorRacion,
        opcional: i.opcional === true,
      }))
      .sort(ordenIngredientes),
  };
}

function filasComida(h: string, e: EstadoHogar): Map<string, FilaComida> {
  const porDia = new Map<string, FilaComida>();
  for (const c of e.comidas) {
    // La clave es la misma que usa la función SQL para borrar: «fecha|momento».
    const actual = porDia.get(`${c.fecha}|cena`);
    if (actual) actual.platos.push(aUuid(h, c.plato.id));
    else {
      porDia.set(`${c.fecha}|cena`, {
        fecha: c.fecha,
        momento: "cena",
        raciones: c.raciones,
        estado: "planificada",
        platos: [aUuid(h, c.plato.id)],
      });
    }
  }
  return porDia;
}

function filasNota(e: EstadoHogar): Map<string, FilaNota> {
  return new Map(
    Object.entries(e.notasMenu).map(([fecha, texto]) => [
      `${fecha}|cena`,
      { fecha: fecha as FechaIso, momento: "cena", texto },
    ]),
  );
}

function filasAlmuerzo(h: string, e: EstadoHogar): FilaAlmuerzo[] {
  return e.almuerzos.map((a) => ({
    id: aUuid(h, a.id),
    fecha: a.fecha,
    texto: a.texto,
    platoId: a.platoId ? aUuid(h, a.platoId) : null,
  }));
}

function filasValoracion(h: string, e: EstadoHogar): Map<string, FilaValoracion> {
  const mapa = new Map<string, FilaValoracion>();
  for (const [plato, porPersona] of Object.entries(e.valoraciones)) {
    for (const [persona, puntos] of Object.entries(porPersona)) {
      const platoId = aUuid(h, plato);
      const personaId = aUuid(h, persona);
      mapa.set(`${platoId}|${personaId}`, { platoId, personaId, puntos });
    }
  }
  return mapa;
}

// --------------------------------------------------------------------------------------------
// Diferencias
// --------------------------------------------------------------------------------------------

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function comparar<T>(antes: Map<string, T>, despues: Map<string, T>) {
  const upsert: T[] = [];
  for (const [k, d] of despues) {
    const a = antes.get(k);
    if (a === undefined || !igual(a, d)) upsert.push(d);
  }
  return { upsert, borrar: [...antes.keys()].filter((k) => !despues.has(k)) };
}

function conGrupo<K extends keyof CambiosMenu>(
  salida: CambiosMenu,
  clave: K,
  r: { upsert: unknown[]; borrar: string[] },
) {
  if (r.upsert.length === 0 && r.borrar.length === 0) return;
  const grupo: Grupo<unknown> = {};
  if (r.upsert.length > 0) grupo.upsert = r.upsert;
  if (r.borrar.length > 0) grupo.borrar = r.borrar;
  (salida as Record<string, unknown>)[clave] = grupo;
}

/** Qué hay que escribir en las tablas del menú para pasar de `antes` a `despues` (o null). */
export function diferenciasMenu(
  antes: EstadoHogar,
  despues: EstadoHogar,
  hogarId: string,
): CambiosMenu | null {
  const salida: CambiosMenu = {};
  const porId = <T extends { id: string }>(f: T[]) => new Map(f.map((x) => [x.id, x]));

  conGrupo(
    salida,
    "platos",
    comparar(
      porId(antes.platos.map((p) => filaPlato(hogarId, p))),
      porId(despues.platos.map((p) => filaPlato(hogarId, p))),
    ),
  );

  const a = new Set(antes.excluirIngredientes);
  const d = new Set(despues.excluirIngredientes);
  conGrupo(salida, "excluidos", {
    upsert: [...d].filter((x) => !a.has(x)),
    borrar: [...a].filter((x) => !d.has(x)),
  });

  conGrupo(salida, "comidas", comparar(filasComida(hogarId, antes), filasComida(hogarId, despues)));
  conGrupo(salida, "notas", comparar(filasNota(antes), filasNota(despues)));
  conGrupo(
    salida,
    "almuerzos",
    comparar(porId(filasAlmuerzo(hogarId, antes)), porId(filasAlmuerzo(hogarId, despues))),
  );
  conGrupo(
    salida,
    "valoraciones",
    comparar(filasValoracion(hogarId, antes), filasValoracion(hogarId, despues)),
  );

  return Object.keys(salida).length > 0 ? salida : null;
}

/** Todo lo que el estado tiene del menú, como si fuera nuevo (importación única). */
export function cambiosCompletosMenu(e: EstadoHogar, hogarId: string): CambiosMenu {
  const vacio: EstadoHogar = {
    ...e,
    platos: [],
    excluirIngredientes: [],
    comidas: [],
    notasMenu: {},
    almuerzos: [],
    valoraciones: {},
  };
  return diferenciasMenu(vacio, e, hogarId) ?? {};
}

// --------------------------------------------------------------------------------------------
// Mezcla de cambios en una lectura (para el motor y para las pruebas)
// --------------------------------------------------------------------------------------------

function lecturaDePlato(f: FilaPlato) {
  return { ...f, minutosActivos: f.minutosActivos as number | null };
}

/** El estado, con la forma de `leer_menu_tablas`. */
export function lecturaDeMenu(e: EstadoHogar, hogarId: string): LecturaMenu {
  const usados = new Set([
    ...e.platos.flatMap((p) => p.ingredientes.map((i) => i.ingredienteId)),
    ...e.excluirIngredientes,
  ]);
  return {
    ingredientes: e.ingredientes
      .filter((i) => usados.has(i.id))
      .map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, seccion: i.seccion })),
    platos: e.platos.map((p) => lecturaDePlato(filaPlato(hogarId, p))),
    excluidos: [...e.excluirIngredientes],
    comidas: [...filasComida(hogarId, e).values()],
    notas: [...filasNota(e).values()],
    almuerzos: filasAlmuerzo(hogarId, e),
    valoraciones: [...filasValoracion(hogarId, e).values()],
  };
}

function mezclar<T>(
  actuales: T[],
  grupo: { upsert?: T[]; borrar?: string[] } | undefined,
  clave: (x: T) => string,
): T[] {
  if (!grupo) return actuales;
  const mapa = new Map(actuales.map((x) => [clave(x), x]));
  for (const n of grupo.upsert ?? []) mapa.set(clave(n), n);
  for (const k of grupo.borrar ?? []) mapa.delete(k);
  return [...mapa.values()];
}

export function aplicarCambiosALecturaMenu(l: LecturaMenu, c: CambiosMenu): LecturaMenu {
  const excluidos = new Set(l.excluidos);
  for (const x of c.excluidos?.upsert ?? []) excluidos.add(x);
  for (const x of c.excluidos?.borrar ?? []) excluidos.delete(x);
  const platos = mezclar(
    l.platos,
    c.platos && { upsert: c.platos.upsert?.map(lecturaDePlato), borrar: c.platos.borrar },
    (x) => x.id,
  );
  const idsPlatos = new Set(platos.map((p) => p.id));
  return {
    ingredientes: l.ingredientes,
    platos,
    excluidos: [...excluidos],
    // Como en la base de datos: un plato borrado desaparece de las cenas y de las valoraciones.
    comidas: mezclar(l.comidas, c.comidas, (x) => `${x.fecha}|${x.momento}`).map((x) => ({
      ...x,
      platos: x.platos.filter((p) => idsPlatos.has(p)),
    })),
    notas: mezclar(l.notas, c.notas, (x) => `${x.fecha}|${x.momento}`),
    almuerzos: mezclar(l.almuerzos, c.almuerzos, (x) => x.id).map((a) =>
      a.platoId && !idsPlatos.has(a.platoId) ? { ...a, platoId: null } : a,
    ),
    valoraciones: mezclar(
      l.valoraciones,
      c.valoraciones,
      (x) => `${x.platoId}|${x.personaId}`,
    ).filter((v) => idsPlatos.has(v.platoId)),
  };
}

// --------------------------------------------------------------------------------------------
// Lectura → estado
// --------------------------------------------------------------------------------------------

/**
 * Pone en el estado lo que hay en las tablas del menú. Los ingredientes que el estado ya tenía y
 * las tablas no nombran (por ejemplo, los de la despensa) se conservan.
 */
export function aplicarLecturaDeMenu(e: EstadoHogar, l: LecturaMenu): EstadoHogar {
  const deTablas: Ingrediente[] = l.ingredientes.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    unidad: i.unidad,
    seccion: (SECCION_VALIDA.has(i.seccion) ? i.seccion : "otros") as Ingrediente["seccion"],
  }));
  const ids = new Set(deTablas.map((i) => i.id));

  const valoraciones: EstadoHogar["valoraciones"] = {};
  for (const v of l.valoraciones) {
    valoraciones[v.platoId] = { ...(valoraciones[v.platoId] ?? {}), [v.personaId]: v.puntos };
  }

  const platos: PlatoMenu[] = l.platos.map((p) => {
    const valores = Object.values(valoraciones[p.id] ?? {});
    return {
      id: p.id,
      nombre: p.nombre,
      grupo: p.grupo,
      minutosActivos: p.minutosActivos ?? 20,
      ingredientes: p.ingredientes.map((i) => ({
        ingredienteId: i.ingredienteId,
        cantidadPorRacion: i.cantidadPorRacion,
        opcional: i.opcional,
      })),
      ultimaVez: p.ultimaVez as FechaIso | null,
      valoracion:
        valores.length === 0
          ? null
          : redondear(valores.reduce((a, b) => a + b, 0) / valores.length, 2),
      ...(p.pasos !== null ? { pasos: p.pasos } : {}),
      ...(p.noProponer ? { noProponer: true } : {}),
      ...(p.porRevisar ? { porRevisar: true } : {}),
      ...(p.ligero ? { ligero: true } : {}),
    };
  });
  const platoPorId = new Map(platos.map((p) => [p.id, p]));

  const comidas: ComidaPlanificada[] = l.comidas
    .filter((c) => c.momento === "cena")
    .flatMap((c) =>
      c.platos.flatMap((id) => {
        const plato = platoPorId.get(id);
        return plato
          ? [
              {
                etiqueta: `Cena del ${nombreDia(c.fecha as FechaIso)}`,
                fecha: c.fecha as FechaIso,
                plato,
                raciones: c.raciones,
              },
            ]
          : [];
      }),
    );

  const notasMenu: EstadoHogar["notasMenu"] = {};
  for (const n of l.notas) if (n.momento === "cena") notasMenu[n.fecha as FechaIso] = n.texto;

  return {
    ...e,
    ingredientes: [...e.ingredientes.filter((i) => !ids.has(i.id)), ...deTablas],
    platos,
    excluirIngredientes: l.excluidos,
    comidas,
    notasMenu,
    almuerzos: l.almuerzos.map((a) => ({
      id: a.id,
      fecha: a.fecha as FechaIso,
      texto: a.texto,
      platoId: a.platoId,
    })),
    valoraciones,
  };
}

// --------------------------------------------------------------------------------------------
// Ids: del estado antiguo (ids de texto) a los de las tablas
// --------------------------------------------------------------------------------------------

/** Mapa «id de ingrediente de la app → id del catálogo». */
export type ResolucionIngredientes = Readonly<Record<string, string>>;

/** Los ingredientes que aún tienen id de texto (no son del catálogo): hay que resolverlos por nombre. */
export function ingredientesPorResolver(
  e: EstadoHogar,
): Array<{ clave: string; nombre: string; unidad: Ingrediente["unidad"]; seccion: string }> {
  return e.ingredientes
    .filter((i) => !esUuid(i.id))
    .map((i) => ({ clave: i.id, nombre: i.nombre, unidad: i.unidad, seccion: i.seccion }));
}

/**
 * Pasa a UUID todos los ids del menú: los platos (estables por hogar), los ingredientes (con la
 * resolución del catálogo) y todo lo que los nombra (despensa, compras, operaciones, ajustes de la
 * compra, cenas, comidas del mediodía, valoraciones). Es idempotente.
 */
export function migrarIdsDeMenu(
  e: EstadoHogar,
  hogarId: string,
  resolucion: ResolucionIngredientes,
): EstadoHogar {
  const ing = (id: string) => resolucion[id] ?? id;
  const plato = (id: string) => aUuid(hogarId, id);

  const platos = e.platos.map((p) => ({
    ...p,
    id: plato(p.id),
    ingredientes: p.ingredientes.map((i) => ({ ...i, ingredienteId: ing(i.ingredienteId) })),
  }));
  const platoPorId = new Map(platos.map((p) => [p.id, p]));

  // Dos ids de texto con el mismo nombre acaban en el mismo ingrediente: se unen.
  const vistos = new Set<string>();
  const ingredientes = e.ingredientes
    .map((i) => ({ ...i, id: ing(i.id) }))
    .filter((i) => (vistos.has(i.id) ? false : (vistos.add(i.id), true)));

  return {
    ...e,
    ingredientes,
    platos,
    excluirIngredientes: [...new Set(e.excluirIngredientes.map(ing))],
    despensa: e.despensa.map((d) => ({ ...d, ingredienteId: ing(d.ingredienteId) })),
    compras: e.compras.map((c) => ({ ...c, ingredienteId: ing(c.ingredienteId) })),
    operaciones: e.operaciones.map((o) => ({
      ...o,
      aplicados: o.aplicados.map((m) => ({ ...m, ingredienteId: ing(m.ingredienteId) })),
    })),
    ajustesCompra: Object.fromEntries(Object.entries(e.ajustesCompra).map(([k, v]) => [ing(k), v])),
    comidas: e.comidas.map((c) => ({ ...c, plato: platoPorId.get(plato(c.plato.id)) ?? c.plato })),
    almuerzos: e.almuerzos.map((a) => ({
      ...a,
      id: aUuid(hogarId, a.id),
      platoId: a.platoId ? plato(a.platoId) : null,
    })),
    valoraciones: Object.fromEntries(Object.entries(e.valoraciones).map(([p, v]) => [plato(p), v])),
  };
}

/**
 * Cuando manda el motor del menú, lo que llega del documento no pisa lo que viene de las tablas
 * (platos, cenas, notas, comidas del mediodía, valoraciones, exclusiones). Lo demás (despensa,
 * compra…) sigue siendo del documento, pero con los ids de ingrediente ya del catálogo.
 */
export function conservarCamposDeMenu(
  nuevo: EstadoHogar,
  actual: EstadoHogar,
  hogarId: string,
  resolucion: ResolucionIngredientes,
): EstadoHogar {
  const mezcla = migrarIdsDeMenu(
    {
      ...nuevo,
      platos: actual.platos,
      excluirIngredientes: actual.excluirIngredientes,
      comidas: actual.comidas,
      notasMenu: actual.notasMenu,
      almuerzos: actual.almuerzos,
      valoraciones: actual.valoraciones,
    },
    hogarId,
    resolucion,
  );
  const propios = new Set(actual.ingredientes.map((i) => i.id));
  return {
    ...mezcla,
    ingredientes: [
      ...actual.ingredientes,
      ...mezcla.ingredientes.filter((i) => !propios.has(i.id)),
    ],
  };
}
