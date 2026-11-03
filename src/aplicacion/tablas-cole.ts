import { z } from "zod";
import type { FechaIso } from "@/dominio/fechas";
import { GRUPOS_PLATO, type GrupoPlato, type MenuCole } from "@/dominio/menu";
import { NOMBRE_GRUPO_ES } from "@/dominio/texto";
import type { EstadoHogar } from "./estado";

/**
 * Puente entre el menú del cole del estado y las tablas (D-104). El menú del cole es del COLEGIO:
 * `centro` → `menu_cole_dia`, compartido por las familias de la clase y con historial de cambios.
 * Es PURO. Mismo esquema que `tablas.ts` y `tablas-menu.ts`: leer, diferencias por fecha y mezcla.
 */

export interface FilaDiaCole {
  fecha: FechaIso;
  primero: string | null;
  segundo: string | null;
  postre: string | null;
  guarnicion: string | null;
  kcal: number | null;
  grupoPrimero: GrupoPlato | null;
  grupoSegundo: GrupoPlato | null;
}

export interface CambiosCole {
  /** Solo si el hogar aún no tiene colegio: se crea y el hogar se vincula como curador. */
  centro?: { nombre: string; localidad: string | null };
  dias?: { upsert?: FilaDiaCole[]; borrar?: FechaIso[] };
}

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const grupo = z.enum(GRUPOS_PLATO).nullable();

export const lecturaColeSchema = z.object({
  centro: z
    .object({
      id: z.string(),
      nombre: z.string(),
      localidad: z.string().nullable(),
      rol: z.string(),
    })
    .nullable(),
  dias: z.array(
    z.object({
      fecha: fechaIso,
      primero: z.string().nullable(),
      segundo: z.string().nullable(),
      postre: z.string().nullable(),
      guarnicion: z.string().nullable(),
      kcal: z.number().int().nullable(),
      grupoPrimero: grupo,
      grupoSegundo: grupo,
    }),
  ),
});
export type LecturaCole = z.infer<typeof lecturaColeSchema>;

export const leerCole = (json: unknown): LecturaCole => lecturaColeSchema.parse(json);

/** ¿Ya hay un menú del cole en tablas? (Sin días no se ha llevado nada: sigue mandando el documento.) */
export const hayColeEnTablas = (l: LecturaCole): boolean => l.dias.length > 0;

/** Nombre del colegio la primera vez; se puede cambiar después. */
export const NOMBRE_COLEGIO_POR_DEFECTO = "Colegio";

const MAX_TEXTO = 200;
const recorta = (t: string | null | undefined): string | null => {
  const limpio = (t ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
  return limpio === "" ? null : limpio;
};

/**
 * La tabla exige al menos un primero o un segundo con texto. Si el día solo trae el tipo de plato
 * (sin el texto del cole), se guarda el nombre del tipo y al leer se reconoce y se descarta.
 */
function fila(fecha: FechaIso, d: MenuCole): FilaDiaCole | null {
  let primero = recorta(d.textoPrimero);
  let segundo = recorta(d.textoSegundo);
  if (primero === null && d.primero) primero = NOMBRE_GRUPO_ES[d.primero] ?? d.primero;
  if (segundo === null && d.segundo) segundo = NOMBRE_GRUPO_ES[d.segundo] ?? d.segundo;
  if (primero === null && segundo === null) return null; // un día sin nada no se guarda
  const kcal =
    typeof d.kcal === "number" && Number.isFinite(d.kcal) && d.kcal >= 0 && d.kcal <= 5000
      ? Math.round(d.kcal)
      : null;
  return {
    fecha,
    primero,
    segundo,
    postre: recorta(d.postre),
    guarnicion: recorta(d.guarnicion),
    kcal,
    grupoPrimero: d.primero,
    grupoSegundo: d.segundo,
  };
}

function filas(e: EstadoHogar): Map<string, FilaDiaCole> {
  const mapa = new Map<string, FilaDiaCole>();
  for (const [fecha, d] of Object.entries(e.colegio)) {
    const f = fila(fecha as FechaIso, d);
    if (f) mapa.set(fecha, f);
  }
  return mapa;
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Qué hay que escribir para pasar de `antes` a `despues` (o null). Siempre lleva el colegio por si hay que crearlo. */
export function diferenciasCole(antes: EstadoHogar, despues: EstadoHogar): CambiosCole | null {
  const a = filas(antes);
  const d = filas(despues);
  const upsert = [...d.values()].filter((f) => !igual(a.get(f.fecha), f));
  const borrar = [...a.keys()].filter((k) => !d.has(k)) as FechaIso[];
  if (upsert.length === 0 && borrar.length === 0) return null;
  return {
    centro: { nombre: NOMBRE_COLEGIO_POR_DEFECTO, localidad: null },
    dias: {
      ...(upsert.length > 0 ? { upsert } : {}),
      ...(borrar.length > 0 ? { borrar } : {}),
    },
  };
}

export const cambiosCompletosCole = (e: EstadoHogar): CambiosCole =>
  diferenciasCole({ ...e, colegio: {} }, e) ?? {};

/** El estado, con la forma de `leer_cole_tablas`. */
export function lecturaDeCole(e: EstadoHogar, centro: LecturaCole["centro"]): LecturaCole {
  return { centro, dias: [...filas(e).values()].sort((x, y) => x.fecha.localeCompare(y.fecha)) };
}

/** Mezcla unos cambios en una lectura, como la función SQL. */
export function aplicarCambiosALecturaCole(l: LecturaCole, c: CambiosCole): LecturaCole {
  const mapa = new Map(l.dias.map((x) => [x.fecha as string, x]));
  for (const f of c.dias?.upsert ?? []) mapa.set(f.fecha, f);
  for (const k of c.dias?.borrar ?? []) mapa.delete(k);
  return {
    centro:
      l.centro ??
      (c.centro
        ? { id: "nuevo", nombre: c.centro.nombre, localidad: c.centro.localidad, rol: "curador" }
        : null),
    dias: [...mapa.values()].sort((x, y) => x.fecha.localeCompare(y.fecha)),
  };
}

/** Pone el menú del cole de las tablas en el estado (las demás fechas del estado se descartan: manda la tabla). */
export function aplicarLecturaDeCole(e: EstadoHogar, l: LecturaCole): EstadoHogar {
  const colegio: EstadoHogar["colegio"] = {};
  for (const d of l.dias) {
    const esRelleno = (texto: string | null, g: GrupoPlato | null) =>
      texto !== null && g !== null && texto === (NOMBRE_GRUPO_ES[g] ?? g);
    colegio[d.fecha as FechaIso] = {
      primero: d.grupoPrimero,
      segundo: d.grupoSegundo,
      textoPrimero: esRelleno(d.primero, d.grupoPrimero) ? null : d.primero,
      textoSegundo: esRelleno(d.segundo, d.grupoSegundo) ? null : d.segundo,
      postre: d.postre,
      guarnicion: d.guarnicion,
      kcal: d.kcal,
    };
  }
  return { ...e, colegio };
}

export interface ResumenCole {
  diasCole: number;
}
export const resumenColeDeCambios = (c: CambiosCole): ResumenCole => ({
  diasCole: c.dias?.upsert?.length ?? 0,
});
export const resumenColeDeLectura = (l: LecturaCole): ResumenCole => ({ diasCole: l.dias.length });

/** El cole del documento no pisa lo que viene de las tablas cuando manda este motor. */
export const conservarCamposDeCole = (nuevo: EstadoHogar, actual: EstadoHogar): EstadoHogar => ({
  ...nuevo,
  colegio: actual.colegio,
});
