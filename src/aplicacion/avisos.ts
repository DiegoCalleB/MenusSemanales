import { type EntradaAvisos, avisosDeHoy } from "@/dominio/avisos";
import { sumarDias } from "@/dominio/fechas";
import { comidasDe, type EstadoHogar } from "./estado";

/** La entrada de los avisos a partir del estado de la app (la campanita). */
export function entradaDeEstado(e: EstadoHogar): EntradaAvisos {
  const manana = sumarDias(e.hoy, 1);
  const platos = (f: string) => comidasDe(e, f).map((c) => c.plato.nombre);
  return {
    hoy: e.hoy,
    cenaHoy: platos(e.hoy),
    cenaManana: platos(manana),
    mananaSinCena: e.saltados.includes(manana),
    comidaHoy: e.almuerzos.filter((a) => a.fecha === e.hoy).map((a) => a.texto),
    citas: e.agenda.map((a) => ({ fecha: a.fecha, titulo: a.titulo, hora: a.hora })),
    tareas: e.casa,
    cumples: e.cumples.map((c) => ({ nombre: c.nombre, dia: c.dia, mes: c.mes })),
  };
}

export const avisosDelEstado = (e: EstadoHogar) => avisosDeHoy(entradaDeEstado(e));
