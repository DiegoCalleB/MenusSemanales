import { type EntradaAvisos, avisosDeHoy } from "@/dominio/avisos";
import { sumarDias } from "@/dominio/fechas";
import { tieneCole } from "./cole";
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
    mochila: e.mochila.map((c) => ({
      texto: c.texto,
      persona: e.personas.find((p) => p.id === c.personaId)?.nombre ?? "",
      personaId: c.personaId,
      dias: c.dias,
      fecha: c.fecha,
      antes: c.antes,
      preparadas: c.preparadas,
      soloConCole: c.soloConCole,
    })),
    diasConCena: [...new Set(e.comidas.map((c) => c.fecha))],
    diasSinCena: e.saltados,
    diasCole: e.diasCole,
    conCole: tieneCole(e),
  };
}

export const avisosDelEstado = (e: EstadoHogar) => avisosDeHoy(entradaDeEstado(e));
