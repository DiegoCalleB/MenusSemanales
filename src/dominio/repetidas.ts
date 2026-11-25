import { type FechaIso, diasEntre, sumarDias } from "./fechas";

/**
 * Fechas que se repiten (D-211): «Viene Yolanda» un miércoles sí y otro no, con un aviso el día antes
 * («Dejar dinero para Yolanda»). Caen siempre en el mismo día del calendario (no se corren por
 * marcarlas tarde) y no se copian como citas sueltas: se calculan al vuelo. Si una vez no toca, se
 * pospone una semana y desde ahí vuelve a repetirse con su ritmo. Puro.
 */

export interface Repetida {
  id: string;
  titulo: string;
  /** «18:00», o null si dura todo el día. */
  hora: string | null;
  /** El día de la próxima vez (y desde él, cada `cadaDias`). */
  desde: FechaIso;
  cadaDias: number;
  /** Qué recordar el día antes («Dejar dinero para Yolanda»), o null. */
  avisoAntes: string | null;
  creadoEn: FechaIso;
}

export const MAX_TITULO_REPETIDA = 80;
export const MAX_REPETIDAS = 30;
export const POSPONER_DIAS = 7;

export const texto = (t: string): string => t.replace(/\s+/g, " ").trim();

/** La próxima vez que cae (hoy incluido). */
export function proximaDe(r: Pick<Repetida, "desde" | "cadaDias">, hoy: FechaIso): FechaIso {
  if (r.desde >= hoy) return r.desde;
  const pasados = diasEntre(r.desde, hoy);
  const saltos = Math.ceil(pasados / r.cadaDias);
  return sumarDias(r.desde, saltos * r.cadaDias);
}

/** Todas las veces que cae entre dos días (ambos incluidos). */
export function ocurrenciasDe(
  r: Pick<Repetida, "desde" | "cadaDias">,
  desde: FechaIso,
  hasta: FechaIso,
): FechaIso[] {
  const salida: FechaIso[] = [];
  let f = proximaDe(r, desde);
  while (f <= hasta && salida.length < 400) {
    salida.push(f);
    f = sumarDias(f, r.cadaDias);
  }
  return salida;
}

export interface EventoRepetido {
  /** Estable (serie + día): sirve de clave y no choca con las citas de verdad. */
  id: string;
  fecha: FechaIso;
  hasta: null;
  hora: string | null;
  titulo: string;
  /** De qué serie sale: no se edita como una cita suelta. */
  repetidaId: string;
}

/**
 * Las citas «virtuales» de las series entre dos días: cada vez que cae y, si lleva aviso, el recordatorio
 * del día antes. Se enseñan como cualquier cita pero no existen como copias. Con `soloProxima`, de cada
 * serie solo la próxima vez; con `recordatorioHasta`, los recordatorios solo hasta ese día (D-212).
 */
export function eventosDeRepetidas(
  series: readonly Repetida[],
  desde: FechaIso,
  hasta: FechaIso,
  opciones: { soloProxima?: boolean; recordatorioHasta?: FechaIso } = {},
): EventoRepetido[] {
  const salida: EventoRepetido[] = [];
  for (const r of series) {
    // Desde el primer día (hoy incluido) y un día más allá: así sale también el recordatorio del último día.
    let ocurrencias = ocurrenciasDe(r, desde, sumarDias(hasta, 1));
    if (opciones.soloProxima) ocurrencias = ocurrencias.slice(0, 1);
    for (const f of ocurrencias) {
      if (f >= desde && f <= hasta) {
        salida.push({
          id: `rep-${r.id}-${f}`,
          fecha: f,
          hasta: null,
          hora: r.hora,
          titulo: r.titulo,
          repetidaId: r.id,
        });
      }
      const antes = sumarDias(f, -1);
      // Los recordatorios son para el día (o la víspera): en las listas largas no se enseñan (D-212).
      const limite = opciones.recordatorioHasta ?? hasta;
      if (r.avisoAntes && antes >= desde && antes <= hasta && antes <= limite) {
        salida.push({
          id: `rep-${r.id}-${f}-antes`,
          fecha: antes,
          hasta: null,
          hora: null,
          titulo: r.avisoAntes,
          repetidaId: r.id,
        });
      }
    }
  }
  return salida.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? "").localeCompare(b.hora ?? ""),
  );
}

/** La próxima vez no toca: se pasa una semana más tarde y desde ahí sigue su ritmo. */
export const posponerUnaSemana = (r: Repetida, hoy: FechaIso): Repetida => ({
  ...r,
  desde: sumarDias(proximaDe(r, hoy), POSPONER_DIAS),
});

export function validarRepetida(
  d: {
    titulo: string;
    hora: string | null;
    desde: string;
    cadaDias: number;
    avisoAntes: string | null;
  },
  fechaValida: (f: string) => boolean,
): { ok: true; datos: Omit<Repetida, "id" | "creadoEn"> } | { ok: false; motivo: string } {
  const titulo = texto(d.titulo);
  if (titulo === "" || titulo.length > MAX_TITULO_REPETIDA) {
    return { ok: false, motivo: `Escribe qué se repite (hasta ${MAX_TITULO_REPETIDA} letras).` };
  }
  if (!fechaValida(d.desde)) return { ok: false, motivo: "Elige el primer día." };
  if (!Number.isInteger(d.cadaDias) || d.cadaDias < 1 || d.cadaDias > 365) {
    return { ok: false, motivo: "Cada cuántos días: de 1 a 365." };
  }
  if (d.hora !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.hora)) {
    return { ok: false, motivo: "La hora, como 18:30." };
  }
  const aviso = d.avisoAntes === null ? "" : texto(d.avisoAntes);
  if (aviso.length > MAX_TITULO_REPETIDA) {
    return { ok: false, motivo: `El recordatorio, hasta ${MAX_TITULO_REPETIDA} letras.` };
  }
  return {
    ok: true,
    datos: {
      titulo,
      hora: d.hora,
      desde: d.desde,
      cadaDias: d.cadaDias,
      avisoAntes: aviso || null,
    },
  };
}

/** «cada semana», «cada 2 semanas», «cada 3 semanas», «cada 10 días». */
export function textoRepeticion(cadaDias: number): string {
  if (cadaDias === 1) return "cada día";
  if (cadaDias % 7 === 0) return cadaDias === 7 ? "cada semana" : `cada ${cadaDias / 7} semanas`;
  return `cada ${cadaDias} días`;
}
