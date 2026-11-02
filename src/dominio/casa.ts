import { type FechaIso, diasEntre, sumarDias } from "./fechas";

/**
 * Lo recurrente de la casa (sábanas, toallas, filtros…): cada tarea tiene su frecuencia, a quién le
 * toca y cuándo se hizo por última vez. La app calcula cuándo toca de nuevo, así que **nadie tiene
 * que acordarse** (D-078). Al marcarla hecha, se reprograma sola desde ese día.
 */

export interface TareaCasa {
  id: string;
  titulo: string;
  emoji: string;
  /** Cada cuántos días se repite. */
  cadaDias: number;
  /** A quién le toca; null = a los dos (a cualquiera de los adultos). */
  responsableId: string | null;
  /** Última vez que se hizo. */
  ultimaVez: FechaIso | null;
  /** Primera vez que toca si nunca se ha hecho. */
  desde: FechaIso;
  /** «Mañana»: no se enseña como pendiente hasta ese día. */
  aplazadaHasta?: FechaIso | null;
  /** Si hay que comprar algo para hacerla («Arena para gatos»): se puede mandar a la lista. */
  compra?: string | null;
}

export type EstadoCasa = "atrasada" | "hoy" | "pronto" | "lejos";

/** Día en que toca la próxima vez. */
export function proximaVez(t: TareaCasa): FechaIso {
  const base = t.ultimaVez ? sumarDias(t.ultimaVez, t.cadaDias) : t.desde;
  return t.aplazadaHasta && t.aplazadaHasta > base ? t.aplazadaHasta : base;
}

/** Días hasta que toca (negativo: va atrasada). */
export const diasParaCasa = (t: TareaCasa, hoy: FechaIso): number => diasEntre(hoy, proximaVez(t));

export function estadoDeCasa(t: TareaCasa, hoy: FechaIso, margen = 7): EstadoCasa {
  const d = diasParaCasa(t, hoy);
  if (d < 0) return "atrasada";
  if (d === 0) return "hoy";
  return d <= margen ? "pronto" : "lejos";
}

/** Marca hecha hoy: se reprograma sola contando desde hoy. */
export const marcarHecha = (t: TareaCasa, hoy: FechaIso): TareaCasa => ({
  ...t,
  ultimaVez: hoy,
  aplazadaHasta: null,
});

/** «Mañana»: se aparta un día (no cambia cuándo se hizo por última vez). */
export const aplazarUnDia = (t: TareaCasa, hoy: FechaIso): TareaCasa => ({
  ...t,
  aplazadaHasta: sumarDias(hoy, 1),
});

/** Las que ya hay que hacer, las más atrasadas primero. */
export function quePideHoy(tareas: readonly TareaCasa[], hoy: FechaIso): TareaCasa[] {
  return tareas
    .filter((t) => diasParaCasa(t, hoy) <= 0)
    .sort(
      (a, b) =>
        diasParaCasa(a, hoy) - diasParaCasa(b, hoy) || a.titulo.localeCompare(b.titulo, "es"),
    );
}

/** Todas, ordenadas por cuándo tocan. */
export const ordenadasPorFecha = (tareas: readonly TareaCasa[], hoy: FechaIso): TareaCasa[] =>
  [...tareas].sort(
    (a, b) => diasParaCasa(a, hoy) - diasParaCasa(b, hoy) || a.titulo.localeCompare(b.titulo, "es"),
  );

/** «cada semana», «cada 3 meses»… en cristiano. */
export function textoFrecuencia(dias: number): string {
  if (dias === 1) return "cada día";
  if (dias === 7) return "cada semana";
  if (dias === 14) return "cada 2 semanas";
  if (dias === 30) return "cada mes";
  if (dias === 90) return "cada 3 meses";
  if (dias === 180) return "cada 6 meses";
  if (dias === 365) return "cada año";
  if (dias % 7 === 0 && dias < 60) return `cada ${dias / 7} semanas`;
  return `cada ${dias} días`;
}

export const FRECUENCIAS_CASA: ReadonlyArray<{ dias: number; texto: string }> = [
  { dias: 3, texto: "Cada 3 días" },
  { dias: 7, texto: "Cada semana" },
  { dias: 14, texto: "Cada 2 semanas" },
  { dias: 30, texto: "Cada mes" },
  { dias: 90, texto: "Cada 3 meses" },
  { dias: 180, texto: "Cada 6 meses" },
  { dias: 365, texto: "Cada año" },
];

/**
 * Plantilla inicial (frecuencias orientativas, editables). Cada una empieza dentro de unos días
 * (`empiezaEn`) para que no caiga todo el mismo día.
 */
export interface PlantillaCasa {
  titulo: string;
  emoji: string;
  cadaDias: number;
  empiezaEn: number;
  compra?: string;
}

export const PLANTILLA_CASA: ReadonlyArray<PlantillaCasa> = [
  { titulo: "Cambiar las sábanas de mamá y papá", emoji: "🛏️", cadaDias: 14, empiezaEn: 0 },
  { titulo: "Cambiar las sábanas de las niñas", emoji: "🧸", cadaDias: 7, empiezaEn: 1 },
  { titulo: "Cambiar las toallas del baño", emoji: "🛁", cadaDias: 7, empiezaEn: 2 },
  { titulo: "Cambiar toallas de manos y trapos de cocina", emoji: "🧺", cadaDias: 3, empiezaEn: 1 },
  { titulo: "Limpiar la nevera", emoji: "🧊", cadaDias: 30, empiezaEn: 6 },
  { titulo: "Limpiar los filtros de la campana", emoji: "🍳", cadaDias: 90, empiezaEn: 12 },
  { titulo: "Cambiar el filtro del aspirador", emoji: "🧹", cadaDias: 90, empiezaEn: 20 },
  { titulo: "Cambiar los cepillos de dientes", emoji: "🪥", cadaDias: 90, empiezaEn: 15 },
  { titulo: "Revisar el botiquín y las caducidades", emoji: "🩹", cadaDias: 180, empiezaEn: 25 },
  { titulo: "Revisión de la caldera", emoji: "🔥", cadaDias: 365, empiezaEn: 40 },
  { titulo: "Revisión del coche", emoji: "🚗", cadaDias: 365, empiezaEn: 45 },
  { titulo: "Cita del dentista de la familia", emoji: "🦷", cadaDias: 180, empiezaEn: 30 },
];

/** Lo que lleva tener dos gatos (D-079). Aparte de la casa: solo se añade si se pide. */
export const PLANTILLA_GATOS: ReadonlyArray<PlantillaCasa> = [
  { titulo: "Limpiar los areneros", emoji: "🐱", cadaDias: 1, empiezaEn: 0 },
  { titulo: "Lavar comederos y bebederos de los gatos", emoji: "🥣", cadaDias: 3, empiezaEn: 1 },
  { titulo: "Cambiar toda la arena de los areneros", emoji: "🧼", cadaDias: 14, empiezaEn: 3 },
  { titulo: "Cepillar a los gatos", emoji: "🪮", cadaDias: 7, empiezaEn: 2 },
  {
    titulo: "Comprar arena para los gatos",
    emoji: "🛒",
    cadaDias: 30,
    empiezaEn: 7,
    compra: "Arena para gatos",
  },
  {
    titulo: "Comprar comida de los gatos",
    emoji: "🥫",
    cadaDias: 14,
    empiezaEn: 5,
    compra: "Comida de los gatos",
  },
  { titulo: "Desparasitar a los gatos", emoji: "💊", cadaDias: 90, empiezaEn: 20 },
  {
    titulo: "Revisión y vacunas de los gatos (veterinario)",
    emoji: "🩺",
    cadaDias: 365,
    empiezaEn: 45,
  },
];

export type ConjuntoCasa = "casa" | "gatos";
export const PLANTILLAS: Record<ConjuntoCasa, ReadonlyArray<PlantillaCasa>> = {
  casa: PLANTILLA_CASA,
  gatos: PLANTILLA_GATOS,
};

/**
 * Reparto sencillo de las que no tienen responsable: alternando entre los adultos, para que
 * ninguno cargue con todo. Es una propuesta que luego se cambia a mano, no el motor de reparto
 * completo.
 */
export function repartirEntre(
  tareas: readonly TareaCasa[],
  adultos: readonly string[],
): TareaCasa[] {
  if (adultos.length === 0) return [...tareas];
  // Se empieza por quien menos lleva ya.
  const cuenta = new Map(
    adultos.map((a) => [a, tareas.filter((t) => t.responsableId === a).length]),
  );
  return tareas.map((t) => {
    if (t.responsableId !== null) return t;
    const [elegido] = [...cuenta.entries()].sort((a, b) => a[1] - b[1]);
    if (!elegido) return t;
    cuenta.set(elegido[0], elegido[1] + 1);
    return { ...t, responsableId: elegido[0] };
  });
}

/** «toca hoy», «toca desde hace 3 días», «toca en 5 días»: sin tono de reproche. */
export function cuandoToca(dias: number): string {
  if (dias < -1) return `toca desde hace ${-dias} días`;
  if (dias === -1) return "tocaba ayer";
  if (dias === 0) return "toca hoy";
  if (dias === 1) return "toca mañana";
  return `toca en ${dias} días`;
}
