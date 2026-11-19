import { type Cuidado, diaDe, lunesDe, resumenDelDia, semanaDeEjercicio } from "./cuidado";
import { diasHasta as diasHastaCumple } from "./cumples";
import { type FechaIso, diasEntre, sumarDias } from "./fechas";
import { type Pendiente, abiertos } from "./pendientes";
import { type Vencimiento, diasHasta as diasHastaVencimiento } from "./vencimientos";

/**
 * La revisión de la semana (D-191): en dos minutos, qué se hizo, qué se quedó y qué viene. Se mira
 * el domingo (o cuando se quiera) y deja la semana siguiente encarrilada. Todo sale de lo que la
 * app ya sabe; no se guarda nada nuevo. Puro.
 */

export interface EntradaRepaso {
  hoy: FechaIso;
  casa: ReadonlyArray<{ titulo: string; emoji: string; ultimaVez: FechaIso | null }>;
  pendientes: readonly Pendiente[];
  /** Lo de quien tiene abierto el móvil, si es una persona del hogar. */
  cuidado: Cuidado | null;
  agenda: ReadonlyArray<{
    fecha: FechaIso;
    hasta: FechaIso | null;
    titulo: string;
    hora: string | null;
  }>;
  vencimientos: readonly Vencimiento[];
  cumples: ReadonlyArray<{ nombre: string; dia: number; mes: number }>;
}

export interface Repaso {
  /** El lunes de la semana que se repasa. */
  desde: FechaIso;
  hecho: {
    casa: string[];
    pendientes: string[];
    /** Días de la semana con toda la lista de «Mi día» hecha, de los días con lista. */
    miDia: { completos: number; dias: number } | null;
    agua: { cumplidos: number } | null;
    ejercicio: { hechas: number; objetivo: number } | null;
  };
  quedo: {
    pendientesViejos: Array<{
      texto: string;
      creadoEn: FechaIso;
      dias: number;
      importante: boolean;
    }>;
    totalPendientes: number;
  };
  viene: {
    citas: Array<{ fecha: FechaIso; titulo: string; hora: string | null }>;
    papeles: Array<{ titulo: string; dias: number }>;
    cumples: Array<{ nombre: string; dias: number }>;
  };
}

const MAX = 6;

export function repasoDeLaSemana(e: EntradaRepaso): Repaso {
  const lunes = lunesDe(e.hoy);
  const diasDeLaSemana = Array.from({ length: diasEntre(lunes, e.hoy) + 1 }, (_, i) =>
    sumarDias(lunes, i),
  );
  const dentro = (f: FechaIso | null) => f !== null && f >= lunes && f <= e.hoy;

  let miDia: Repaso["hecho"]["miDia"] = null;
  let agua: Repaso["hecho"]["agua"] = null;
  let ejercicio: Repaso["hecho"]["ejercicio"] = null;
  if (e.cuidado) {
    const c = e.cuidado;
    const conLista = diasDeLaSemana.map((f) => resumenDelDia(c, f)).filter((r) => r.total > 0);
    if (conLista.length > 0) {
      miDia = {
        completos: conLista.filter((r) => r.hechos === r.total).length,
        dias: conLista.length,
      };
    }
    const usaAgua = diasDeLaSemana.some((f) => diaDe(c, f).agua > 0);
    if (usaAgua) {
      agua = { cumplidos: diasDeLaSemana.filter((f) => diaDe(c, f).agua >= c.metaAgua).length };
    }
    const s = semanaDeEjercicio(c, e.hoy);
    if (s.objetivo > 0) ejercicio = s;
  }

  const abiertosAhora = abiertos(e.pendientes);
  const hasta = sumarDias(e.hoy, 7);
  return {
    desde: lunes,
    hecho: {
      casa: e.casa.filter((t) => dentro(t.ultimaVez)).map((t) => `${t.emoji} ${t.titulo}`),
      pendientes: e.pendientes
        .filter((p) => dentro(p.hechoEn))
        .map((p) => p.texto)
        .slice(0, MAX),
      miDia,
      agua,
      ejercicio,
    },
    quedo: {
      pendientesViejos: abiertosAhora
        .filter((p) => diasEntre(p.creadoEn, e.hoy) >= 7)
        .slice(0, MAX)
        .map((p) => ({
          texto: p.texto,
          creadoEn: p.creadoEn,
          dias: diasEntre(p.creadoEn, e.hoy),
          importante: p.importante,
        })),
      totalPendientes: abiertosAhora.length,
    },
    viene: {
      citas: e.agenda
        .filter((a) => a.fecha > e.hoy && a.fecha <= hasta)
        .sort(
          (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""),
        )
        .slice(0, MAX)
        .map((a) => ({ fecha: a.fecha, titulo: a.titulo, hora: a.hora })),
      papeles: e.vencimientos
        .filter((v) => v.hechoEn === null && diasHastaVencimiento(v, e.hoy) <= 14)
        .map((v) => ({ titulo: v.titulo, dias: diasHastaVencimiento(v, e.hoy) }))
        .sort((a, b) => a.dias - b.dias)
        .slice(0, MAX),
      cumples: e.cumples
        .map((c) => ({ nombre: c.nombre, dias: diasHastaCumple(c, e.hoy) }))
        .filter((c) => c.dias >= 1 && c.dias <= 14)
        .sort((a, b) => a.dias - b.dias)
        .slice(0, MAX),
    },
  };
}
