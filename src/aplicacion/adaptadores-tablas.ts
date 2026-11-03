import { esUuid } from "@/dominio/identificadores";
import type { EstadoHogar } from "./estado";
import {
  type CambiosTablas,
  type LecturaTablas,
  aplicarCambiosALectura,
  aplicarLecturaDeTablas,
  diferencias,
  hayHogarEnTablas,
  migrarIdsDePersonas,
} from "./tablas";
import {
  type CambiosRegistro,
  type LecturaRegistro,
  aplicarCambiosALecturaRegistro,
  aplicarLecturaDeRegistro,
  diferenciasRegistro,
  hayRegistroEnTablas,
} from "./tablas-registro";
import {
  type CambiosCole,
  type LecturaCole,
  aplicarCambiosALecturaCole,
  aplicarLecturaDeCole,
  diferenciasCole,
  hayColeEnTablas,
} from "./tablas-cole";
import {
  type CambiosMenu,
  type LecturaMenu,
  type ResolucionIngredientes,
  aplicarCambiosALecturaMenu,
  aplicarLecturaDeMenu,
  diferenciasMenu,
  hayMenuEnTablas,
  ingredientesPorResolver,
  migrarIdsDeMenu,
} from "./tablas-menu";

/**
 * Un AGREGADO que vive en tablas (D-101): sabe leer sus tablas, calcular qué cambió por
 * identificador y mezclar cambios. El motor (`SincronizadorTablas`) es el mismo para todos.
 */
export interface Adaptador<L, C> {
  /** ¿Las tablas de este agregado ya tienen datos? Si no, sigue mandando el documento. */
  hayDatos(lectura: L): boolean;
  /** Pone la lectura en el estado (solo los campos de este agregado). */
  aEstado(sobre: EstadoHogar, lectura: L): EstadoHogar;
  diferencias(antes: EstadoHogar, despues: EstadoHogar): C | null;
  aplicarALectura(lectura: L, cambios: C): L;
  /** Resumen de los campos de este agregado, para saber si algo cambió de verdad. */
  huella(e: EstadoHogar): string;
  /** Prepara el estado local antes de adoptar las tablas (ids). Puede ser asíncrono. */
  preparar(local: EstadoHogar): Promise<EstadoHogar> | EstadoHogar;
  /**
   * Antes de enviar: si hay algo que la base de datos no aceptaría tal cual, devuelve el estado
   * arreglado (el motor lo escribe y recalcula); si no, `null`.
   */
  antesDeEnviar?(actual: EstadoHogar): Promise<EstadoHogar | null>;
}

/** Personas, cumpleaños, apuntes, fechas, tareas de casa y por persona, días y horizonte (D-095). */
export function adaptadorHogar(hogarId: string): Adaptador<LecturaTablas, CambiosTablas> {
  return {
    hayDatos: hayHogarEnTablas,
    aEstado: aplicarLecturaDeTablas,
    diferencias: (a, d) => diferencias(a, d, hogarId),
    aplicarALectura: aplicarCambiosALectura,
    huella: (e) =>
      JSON.stringify([
        e.personas,
        e.horizonte,
        e.llegoTarde,
        e.saltados,
        e.cumples,
        e.agenda,
        e.eventos,
        e.casa,
        e.tareas,
      ]),
    preparar: (local) => migrarIdsDePersonas(local, hogarId),
  };
}

export type ResolverIngredientes = (
  ingredientes: Array<{ clave: string; nombre: string; unidad: string; seccion: string }>,
) => Promise<ResolucionIngredientes>;

/**
 * El menú: platos con ingredientes, cenas con varios platos, notas, comidas del mediodía,
 * valoraciones y exclusiones (D-101). Los ingredientes son un catálogo compartido: se resuelven
 * por nombre con `resolver` y el mapa se guarda para traducir también lo que llegue del documento.
 */
export function adaptadorMenu(hogarId: string, resolver: ResolverIngredientes) {
  let resolucion: ResolucionIngredientes = {};

  const resolverLos = async (e: EstadoHogar): Promise<EstadoHogar> => {
    const pendientes = ingredientesPorResolver(e);
    if (pendientes.length > 0) resolucion = { ...resolucion, ...(await resolver(pendientes)) };
    return migrarIdsDePersonas(migrarIdsDeMenu(e, hogarId, resolucion), hogarId);
  };

  const adaptador: Adaptador<LecturaMenu, CambiosMenu> = {
    hayDatos: hayMenuEnTablas,
    aEstado: aplicarLecturaDeMenu,
    diferencias: (a, d) => diferenciasMenu(a, d, hogarId),
    aplicarALectura: aplicarCambiosALecturaMenu,
    huella: (e) =>
      JSON.stringify([
        e.platos,
        e.excluirIngredientes,
        e.comidas.map((c) => [c.fecha, c.plato.id, c.raciones]),
        e.notasMenu,
        e.almuerzos,
        e.valoraciones,
      ]),
    preparar: resolverLos,
    antesDeEnviar: async (actual) => {
      // Un ingrediente creado después de adoptar el menú aún tiene id de texto: se resuelve.
      const sinResolver = actual.ingredientes.some((i) => !esUuid(i.id));
      return sinResolver ? resolverLos(actual) : null;
    },
  };
  return { adaptador, resolucion: (): ResolucionIngredientes => resolucion };
}

/** El menú del cole del colegio del hogar (D-104). Sus ids son fechas: no hay nada que migrar. */
export const adaptadorCole: Adaptador<LecturaCole, CambiosCole> = {
  hayDatos: hayColeEnTablas,
  aEstado: aplicarLecturaDeCole,
  diferencias: diferenciasCole,
  aplicarALectura: aplicarCambiosALecturaCole,
  huella: (e) => JSON.stringify(e.colegio),
  preparar: (local) => local,
};

/** «Lo de hoy»: quién ha hecho qué cada día (D-108). Nace en tablas: ids ya son UUID. */
export const adaptadorRegistro: Adaptador<LecturaRegistro, CambiosRegistro> = {
  hayDatos: hayRegistroEnTablas,
  aEstado: aplicarLecturaDeRegistro,
  diferencias: diferenciasRegistro,
  aplicarALectura: aplicarCambiosALecturaRegistro,
  huella: (e) => JSON.stringify(e.registro),
  preparar: (local) => local,
};
