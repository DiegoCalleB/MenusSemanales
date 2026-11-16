import { type FechaIso, diasEntre, sumarDias } from "./fechas";

/**
 * Papeles y vencimientos (D-174): lo que caduca o hay que renovar y se olvida (la ITV, el seguro del
 * coche, el DNI y el pasaporte de cada uno, la revisión de la caldera, la declaración de la renta…).
 * Cada uno tiene la fecha en que vence, si se repite (cada año, cada diez…) y con cuántos días de
 * margen avisar. Al renovarlo se pasa a la fecha siguiente; lo que no se repite se da por hecho.
 * Solo se guarda un nombre, una fecha y notas: nunca números de documento. Puro.
 */

export type CategoriaVencimiento = "coche" | "casa" | "documentos" | "salud" | "dinero" | "otro";

export const CATEGORIAS: ReadonlyArray<{
  id: CategoriaVencimiento;
  texto: string;
  emoji: string;
}> = [
  { id: "coche", texto: "Coche", emoji: "🚗" },
  { id: "casa", texto: "Casa", emoji: "🏠" },
  { id: "documentos", texto: "Documentos", emoji: "🪪" },
  { id: "salud", texto: "Salud", emoji: "🩺" },
  { id: "dinero", texto: "Dinero", emoji: "💶" },
  { id: "otro", texto: "Otro", emoji: "📄" },
];
export const emojiDe = (c: CategoriaVencimiento): string =>
  CATEGORIAS.find((x) => x.id === c)?.emoji ?? "📄";

export interface Vencimiento {
  id: string;
  titulo: string;
  categoria: CategoriaVencimiento;
  /** De quién es (el DNI de Alba); null si es de toda la familia (el seguro del coche). */
  personaId: string | null;
  /** El día en que vence (o en que hay que hacerlo). */
  fecha: FechaIso;
  /** Cada cuántos meses se repite (12 = cada año); null si no se repite. */
  repiteMeses: number | null;
  /** Con cuántos días de margen se avisa (0 = el mismo día), de mayor a menor. */
  avisos: number[];
  notas: string;
  /** Solo los que no se repiten: el día en que se dieron por hechos. */
  hechoEn: FechaIso | null;
  /** Las fechas de vencimiento anteriores (las últimas), para ver cuándo se renovó. */
  renovado: FechaIso[];
}

export const MAX_TITULO_VENCIMIENTO = 80;
export const MAX_NOTAS_VENCIMIENTO = 300;
export const MAX_VENCIMIENTOS = 200;
/** Los días de margen que se pueden elegir. */
export const MARGENES = [90, 60, 30, 14, 7, 3, 1, 0] as const;
export const MAX_REPITE_MESES = 600;
const MAX_RENOVADOS = 5;
/** Pasado el vencimiento se recuerda a estos días: no cada día, para no agobiar. */
export const AVISAR_VENCIDO: ReadonlySet<number> = new Set([1, 7, 14, 30]);

/** Días hasta el vencimiento (negativo si ya venció). */
export const diasHasta = (v: Pick<Vencimiento, "fecha">, hoy: FechaIso): number =>
  diasEntre(hoy, v.fecha);

export type EstadoVencimiento = "vencido" | "urgente" | "pronto" | "lejos";

export function estadoDe(v: Pick<Vencimiento, "fecha">, hoy: FechaIso): EstadoVencimiento {
  const d = diasHasta(v, hoy);
  return d < 0 ? "vencido" : d <= 7 ? "urgente" : d <= 30 ? "pronto" : "lejos";
}

/** Suma meses a una fecha sin pasarse de mes: 31 de enero + 1 mes = 28 (o 29) de febrero. */
export function sumarMeses(fecha: FechaIso, meses: number): FechaIso {
  const [a, m, d] = fecha.split("-").map(Number) as [number, number, number];
  const total = a * 12 + (m - 1) + meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/**
 * La fecha que se propone al renovar: la siguiente que toca (la del vencimiento más lo que se
 * repite), saltando las que ya han pasado si se renueva tarde. null si no se repite.
 */
export function fechaAlRenovar(v: Vencimiento, hoy: FechaIso): FechaIso | null {
  if (v.repiteMeses === null || v.repiteMeses <= 0) return null;
  let f = sumarMeses(v.fecha, v.repiteMeses);
  for (let i = 0; i < 100 && f <= hoy; i++) f = sumarMeses(f, v.repiteMeses);
  return f;
}

/** «cada año», «cada 2 años», «cada 6 meses», «cada 18 meses». */
export function textoRepite(meses: number | null): string {
  if (meses === null) return "no se repite";
  if (meses === 12) return "cada año";
  if (meses === 1) return "cada mes";
  if (meses % 12 === 0) return `cada ${meses / 12} años`;
  return `cada ${meses} meses`;
}

/** «hoy», «mañana», «en 12 días», «en 3 meses», «venció ayer», «venció hace 5 días». */
export function textoCuando(dias: number): string {
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias === -1) return "venció ayer";
  const n = Math.abs(dias);
  const medida = n <= 45 ? `${n} días` : `${Math.round(n / 30)} meses`;
  return dias > 0 ? `vence en ${medida}` : `venció hace ${medida}`;
}

/** Del que vence antes al que vence después (los vencidos, primero). */
export const porFecha = (a: Vencimiento, b: Vencimiento): number =>
  a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, "es");

export interface Agrupados {
  vencidos: Vencimiento[];
  /** En los próximos 30 días. */
  proximos: Vencimiento[];
  despues: Vencimiento[];
  hechos: Vencimiento[];
}

export function agrupar(vencimientos: readonly Vencimiento[], hoy: FechaIso): Agrupados {
  const g: Agrupados = { vencidos: [], proximos: [], despues: [], hechos: [] };
  for (const v of [...vencimientos].sort(porFecha)) {
    if (v.hechoEn !== null) g.hechos.push(v);
    else {
      const d = diasHasta(v, hoy);
      (d < 0 ? g.vencidos : d <= 30 ? g.proximos : g.despues).push(v);
    }
  }
  g.hechos.reverse();
  return g;
}

/** Lo que merece estar en «Hoy»: lo vencido y lo que vence en las próximas dos semanas. */
export function paraHoy(vencimientos: readonly Vencimiento[], hoy: FechaIso): Vencimiento[] {
  return vencimientos.filter((v) => v.hechoEn === null && diasHasta(v, hoy) <= 14).sort(porFecha);
}

export interface AvisoVencimiento {
  id: string;
  /** «ITV del coche vence en 7 días». */
  texto: string;
  nivel: "ya" | "pronto" | "info";
  dias: number;
}

/**
 * Los vencimientos de los que hay que avisar hoy: los que están a uno de sus días de margen y, ya
 * vencidos, al día siguiente y a la semana, a las dos y al mes (no cada día).
 */
export function avisosDeVencimientos(
  vencimientos: readonly Vencimiento[],
  hoy: FechaIso,
  personas: ReadonlyArray<{ id: string; nombre: string }> = [],
): AvisoVencimiento[] {
  const out: AvisoVencimiento[] = [];
  for (const v of [...vencimientos].sort(porFecha)) {
    if (v.hechoEn !== null) continue;
    const dias = diasHasta(v, hoy);
    const toca = dias >= 0 ? v.avisos.includes(dias) : AVISAR_VENCIDO.has(-dias);
    if (!toca) continue;
    const de = v.personaId ? personas.find((p) => p.id === v.personaId)?.nombre : undefined;
    out.push({
      id: `papel-${v.id}-${dias}`,
      texto: `${v.titulo}${de ? ` de ${de}` : ""} ${textoCuando(dias)}`,
      nivel: dias < 0 || dias <= 1 ? "ya" : dias <= 14 ? "pronto" : "info",
      dias,
    });
  }
  return out;
}

export interface Plantilla {
  id: string;
  emoji: string;
  titulo: string;
  categoria: CategoriaVencimiento;
  /** Si es de una persona (el DNI) o de toda la familia (el seguro del coche). */
  personal: boolean;
  repiteMeses: number | null;
  avisos: number[];
  /** Una pista para rellenarlo. */
  pista: string;
}

const DOC = [90, 30, 7];
const SEGURO = [30, 7, 1];
const REVISION = [14, 1];

export const PLANTILLAS: readonly Plantilla[] = [
  {
    id: "itv",
    emoji: "🚗",
    titulo: "ITV del coche",
    categoria: "coche",
    personal: false,
    repiteMeses: 12,
    avisos: [30, 14, 1],
    pista: "Cada año, o cada dos si el coche es nuevo: pon la fecha de la última ITV.",
  },
  {
    id: "seguro-coche",
    emoji: "🛡️",
    titulo: "Seguro del coche",
    categoria: "coche",
    personal: false,
    repiteMeses: 12,
    avisos: SEGURO,
    pista: "La fecha de renovación de la póliza.",
  },
  {
    id: "circulacion",
    emoji: "🧾",
    titulo: "Impuesto de circulación",
    categoria: "coche",
    personal: false,
    repiteMeses: 12,
    avisos: REVISION,
    pista: "El recibo del ayuntamiento (suele ser cada año).",
  },
  {
    id: "carnet",
    emoji: "🚘",
    titulo: "Carné de conducir",
    categoria: "documentos",
    personal: true,
    repiteMeses: 120,
    avisos: DOC,
    pista: "La fecha de caducidad que aparece en el carné.",
  },
  {
    id: "dni",
    emoji: "🪪",
    titulo: "DNI",
    categoria: "documentos",
    personal: true,
    repiteMeses: 120,
    avisos: DOC,
    pista: "La fecha de validez del DNI. Se renueva cada 5 o 10 años según la edad.",
  },
  {
    id: "pasaporte",
    emoji: "🛂",
    titulo: "Pasaporte",
    categoria: "documentos",
    personal: true,
    repiteMeses: 120,
    avisos: DOC,
    pista: "La fecha de caducidad del pasaporte. Antes de viajar, comprueba que quede margen.",
  },
  {
    id: "certificado",
    emoji: "🔐",
    titulo: "Certificado digital",
    categoria: "documentos",
    personal: true,
    repiteMeses: 48,
    avisos: [30, 7],
    pista: "Caduca y hay que renovarlo para hacer trámites con Hacienda.",
  },
  {
    id: "seguro-hogar",
    emoji: "🏠",
    titulo: "Seguro del hogar",
    categoria: "casa",
    personal: false,
    repiteMeses: 12,
    avisos: SEGURO,
    pista: "La fecha de renovación de la póliza.",
  },
  {
    id: "caldera",
    emoji: "🔥",
    titulo: "Revisión de la caldera",
    categoria: "casa",
    personal: false,
    repiteMeses: 12,
    avisos: REVISION,
    pista: "Según tu contrato de mantenimiento.",
  },
  {
    id: "ibi",
    emoji: "🧾",
    titulo: "IBI",
    categoria: "casa",
    personal: false,
    repiteMeses: 12,
    avisos: REVISION,
    pista: "El recibo del ayuntamiento.",
  },
  {
    id: "dentista",
    emoji: "🦷",
    titulo: "Revisión del dentista",
    categoria: "salud",
    personal: true,
    repiteMeses: 6,
    avisos: REVISION,
    pista: "Cuándo toca la próxima revisión.",
  },
  {
    id: "pediatra",
    emoji: "🧸",
    titulo: "Revisión del pediatra",
    categoria: "salud",
    personal: true,
    repiteMeses: 12,
    avisos: REVISION,
    pista: "La próxima revisión o vacuna del calendario.",
  },
  {
    id: "oculista",
    emoji: "👓",
    titulo: "Revisión de la vista",
    categoria: "salud",
    personal: true,
    repiteMeses: 12,
    avisos: REVISION,
    pista: "Cuándo toca revisar la graduación.",
  },
  {
    id: "renta",
    emoji: "💶",
    titulo: "Declaración de la renta",
    categoria: "dinero",
    personal: false,
    repiteMeses: 12,
    avisos: [30, 7, 1],
    pista: "El último día de la campaña de la renta.",
  },
  {
    id: "seguro-vida",
    emoji: "💙",
    titulo: "Seguro de vida",
    categoria: "dinero",
    personal: false,
    repiteMeses: 12,
    avisos: SEGURO,
    pista: "La fecha de renovación de la póliza.",
  },
  {
    id: "abono",
    emoji: "🚇",
    titulo: "Abono transporte",
    categoria: "dinero",
    personal: true,
    repiteMeses: 12,
    avisos: [14, 1],
    pista: "Cuándo caduca la tarjeta o el abono.",
  },
];

export interface DatosVencimiento {
  titulo: string;
  categoria: CategoriaVencimiento;
  personaId: string | null;
  fecha: FechaIso;
  repiteMeses: number | null;
  avisos: number[];
  notas: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaValida = (f: string): boolean => {
  if (!FECHA.test(f)) return false;
  const d = new Date(`${f}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
};
export const esFechaValida = fechaValida;

/**
 * Comprueba y limpia lo que escribe la familia. Devuelve los datos listos para guardar o el motivo
 * (en español, para enseñarlo tal cual).
 */
export function validarDatos(
  d: DatosVencimiento,
  personasValidas: ReadonlySet<string>,
): { ok: true; datos: DatosVencimiento } | { ok: false; motivo: string } {
  const titulo = d.titulo.replace(/\s+/g, " ").trim();
  if (titulo === "" || titulo.length > MAX_TITULO_VENCIMIENTO) {
    return { ok: false, motivo: `Ponle un nombre (hasta ${MAX_TITULO_VENCIMIENTO} letras).` };
  }
  if (!CATEGORIAS.some((c) => c.id === d.categoria)) {
    return { ok: false, motivo: "Elige de qué tipo es." };
  }
  if (!fechaValida(d.fecha) || d.fecha < "2000-01-01" || d.fecha > "2200-12-31") {
    return { ok: false, motivo: "Elige el día en que vence." };
  }
  if (d.personaId !== null && !personasValidas.has(d.personaId)) {
    return { ok: false, motivo: "Esa persona no está en la familia." };
  }
  const rep = d.repiteMeses;
  if (rep !== null && (!Number.isInteger(rep) || rep < 1 || rep > MAX_REPITE_MESES)) {
    return { ok: false, motivo: "Cada cuánto se repite no es válido." };
  }
  const avisos = [...new Set(d.avisos)].filter((a) => (MARGENES as readonly number[]).includes(a));
  if (avisos.length !== new Set(d.avisos).size) {
    return { ok: false, motivo: "Elige los avisos de la lista." };
  }
  avisos.sort((a, b) => b - a);
  const notas = d.notas.replace(/\r\n?/g, "\n").trim();
  if (notas.length > MAX_NOTAS_VENCIMIENTO) {
    return { ok: false, motivo: `Las notas, hasta ${MAX_NOTAS_VENCIMIENTO} letras.` };
  }
  return {
    ok: true,
    datos: {
      titulo,
      categoria: d.categoria,
      personaId: d.personaId,
      fecha: d.fecha,
      repiteMeses: rep,
      avisos,
      notas,
    },
  };
}

/** Pasa a la nueva fecha guardando la anterior (solo las últimas). */
export function renovar(v: Vencimiento, nueva: FechaIso): Vencimiento {
  return {
    ...v,
    fecha: nueva,
    hechoEn: null,
    renovado: [...v.renovado, v.fecha].slice(-MAX_RENOVADOS),
  };
}

/** La fecha de ayer, por si hace falta para «vence hoy» y similares en pruebas. */
export const ayer = (hoy: FechaIso): FechaIso => sumarDias(hoy, -1);
