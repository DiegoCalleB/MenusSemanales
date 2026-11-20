import { type FechaIso, diasEntre } from "./fechas";

/**
 * Objetivos a plazos (D-195): lo que cada persona quiere conseguir «hasta el 31 de diciembre», «hasta
 * marzo»… Son personales y no salen de la app (ni buscador, ni IA, ni calendario, ni avisos del
 * servidor). Se agrupan por plazo, se marcan al conseguirlos y se pueden pegar de golpe como una
 * lista escrita a mano. Puro.
 */

export interface Objetivo {
  id: string;
  personaId: string;
  texto: string;
  /** El día hasta el que se quiere conseguir. */
  hasta: FechaIso;
  /** El día en que se consiguió; null si sigue en marcha. */
  hechoEn: FechaIso | null;
  /** El día en que se apuntó. */
  creadoEn: FechaIso;
  /** La próxima acción concreta que lo mueve («llamar a…»); null si no hay. */
  siguiente: string | null;
  /** El último día que se avanzó (se hizo un paso o, si se repite, se hizo). */
  movidoEn: FechaIso | null;
  /** Cada cuántos días hay que hacerlo («Plan a solas con Lucía», cada 7); null si no se repite. */
  cada: number | null;
}

/** Sin avanzar tantos días, un objetivo se da por parado. */
export const DIAS_PARADO = 14;
export const MAX_CADA = 365;

export const MAX_TEXTO_OBJETIVO = 100;
/** En todo el hogar; los conseguidos se quedan (es un cuaderno, no una lista del día). */
export const MAX_OBJETIVOS = 300;

export const limpiar = (t: string): string => t.replace(/\s+/g, " ").trim();

const clave = (t: string): string =>
  limpiar(t)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const MESES: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sept: 9,
  sep: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

const NOMBRE_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const pad = (n: number): string => String(n).padStart(2, "0");
const diasDelMes = (a: number, m: number): number => new Date(Date.UTC(a, m, 0)).getUTCDate();

/** ¿Es una fecha ISO real? */
export function fechaValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  try {
    diasEntre(f, f);
    return true;
  } catch {
    return false;
  }
}

/**
 * Entiende un plazo escrito a mano: «Hasta 31 diciembre 2026», «Objetivos hasta Marzo 2027»,
 * «hasta el 15 de junio» o solo «Marzo 2027». Sin día, es el último del mes; sin año, el próximo que
 * no haya pasado. Si la línea es otra cosa (un objetivo), devuelve null.
 */
export function plazoDeTexto(linea: string, hoy: FechaIso): FechaIso | null {
  const t = clave(linea)
    .replace(/[:.]+$/, "")
    .replace(/^(objetivos?|metas?)\s+/, "")
    .trim();
  const m =
    /^(?:(?:hasta|para)\s+)?(?:el\s+)?(?:(\d{1,2})\s+(?:de\s+)?)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?$/.exec(
      t,
    );
  if (!m) return null;
  const mes = MESES[m[2] ?? ""];
  if (!mes) return null;
  const [anoHoy] = hoy.split("-").map(Number) as [number, number, number];
  const resolver = (ano: number): FechaIso | null => {
    const dia = m[1] ? Number(m[1]) : diasDelMes(ano, mes);
    if (dia < 1 || dia > diasDelMes(ano, mes)) return null;
    return `${ano}-${pad(mes)}-${pad(dia)}`;
  };
  if (m[3]) return resolver(Number(m[3]));
  const esteAno = resolver(anoHoy);
  if (esteAno !== null && esteAno >= hoy) return esteAno;
  return resolver(anoHoy + 1);
}

export interface ItemImportado {
  texto: string;
  cada: number | null;
}

export interface GrupoImportado {
  hasta: FechaIso;
  items: ItemImportado[];
}

const UNIDAD_DIAS: Record<string, number> = {
  dia: 1,
  dias: 1,
  semana: 7,
  semanas: 7,
  mes: 30,
  meses: 30,
};

/**
 * «Plan a solas con Lucía (cada semana)» → el texto y cada cuántos días. Entiende «cada día»,
 * «cada semana», «cada 2 semanas», «cada mes», «cada 10 días». Sin paréntesis, no se repite.
 */
export function separarCada(linea: string): ItemImportado {
  const m = /\s*\(\s*cada\s+(?:(\d+)\s+)?([a-záéíóú]+)\s*\)\s*$/iu.exec(linea);
  if (!m) return { texto: limpiar(linea), cada: null };
  const unidad = UNIDAD_DIAS[clave(m[2] ?? "")];
  if (!unidad) return { texto: limpiar(linea), cada: null };
  const cada = unidad * (m[1] ? Number(m[1]) : 1);
  if (cada < 1 || cada > MAX_CADA) return { texto: limpiar(linea), cada: null };
  return { texto: limpiar(linea.slice(0, m.index)), cada };
}

/** «cada semana», «cada 2 semanas», «cada mes», «cada 10 días». */
export function textoCada(cada: number): string {
  if (cada === 1) return "cada día";
  if (cada % 30 === 0) return cada === 30 ? "cada mes" : `cada ${cada / 30} meses`;
  if (cada % 7 === 0) return cada === 7 ? "cada semana" : `cada ${cada / 7} semanas`;
  return `cada ${cada} días`;
}

/**
 * Lee una lista pegada: una línea de plazo abre un grupo y lo que va debajo son sus objetivos
 * (con o sin guion). Lo de antes del primer plazo no se sabe de cuándo es, y se avisa.
 */
export function leerLista(
  texto: string,
  hoy: FechaIso,
): { ok: true; grupos: GrupoImportado[] } | { ok: false; motivo: string } {
  const grupos: GrupoImportado[] = [];
  let actual: GrupoImportado | null = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const linea = limpiar(bruta.replace(/^\s*(?:[-–•*·]|\d+[.)])\s+/u, ""));
    if (linea === "") continue;
    const plazo = plazoDeTexto(linea, hoy);
    if (plazo) {
      actual = grupos.find((g) => g.hasta === plazo) ?? null;
      if (!actual) {
        actual = { hasta: plazo, items: [] };
        grupos.push(actual);
      }
      continue;
    }
    if (!actual) {
      return {
        ok: false,
        motivo:
          "Empieza con un plazo, por ejemplo «Hasta 31 diciembre 2026», y debajo tus objetivos.",
      };
    }
    const item = separarCada(linea);
    if (item.texto === "" || item.texto.length > MAX_TEXTO_OBJETIVO) {
      return {
        ok: false,
        motivo: `«${linea.slice(0, 30)}…» es muy largo: hasta ${MAX_TEXTO_OBJETIVO} letras cada objetivo.`,
      };
    }
    if (!actual.items.some((x) => clave(x.texto) === clave(item.texto))) actual.items.push(item);
  }
  const hay = grupos.some((g) => g.items.length > 0);
  if (!hay) return { ok: false, motivo: "No he encontrado ningún objetivo en lo que has pegado." };
  return { ok: true, grupos: grupos.filter((g) => g.items.length > 0) };
}

export function validarObjetivo(
  d: { personaId: string; texto: string; hasta: FechaIso; cada?: number | null },
  personasValidas: ReadonlySet<string>,
):
  | { ok: true; datos: { personaId: string; texto: string; hasta: FechaIso; cada: number | null } }
  | { ok: false; motivo: string } {
  const t = limpiar(d.texto);
  if (t === "" || t.length > MAX_TEXTO_OBJETIVO) {
    return { ok: false, motivo: `Escribe el objetivo (hasta ${MAX_TEXTO_OBJETIVO} letras).` };
  }
  if (!fechaValida(d.hasta)) return { ok: false, motivo: "Elige hasta qué día." };
  if (!personasValidas.has(d.personaId)) {
    return { ok: false, motivo: "Esa persona no está en la familia." };
  }
  const cada = d.cada ?? null;
  if (cada !== null && (!Number.isInteger(cada) || cada < 1 || cada > MAX_CADA)) {
    return { ok: false, motivo: "Cada cuántos días: de 1 a 365." };
  }
  return { ok: true, datos: { personaId: d.personaId, texto: t, hasta: d.hasta, cada } };
}

export const mismoObjetivo = (a: { texto: string; hasta: FechaIso }, b: Objetivo): boolean =>
  a.hasta === b.hasta && clave(a.texto) === clave(b.texto);

export interface GrupoDePlazo {
  hasta: FechaIso;
  objetivos: Objetivo[];
  hechos: number;
}

/** Lo de una persona, por plazo: primero el que vence antes; dentro, lo pendiente antes que lo hecho. */
export function porPlazo(objetivos: readonly Objetivo[], personaId: string): GrupoDePlazo[] {
  const grupos = new Map<FechaIso, Objetivo[]>();
  for (const o of objetivos) {
    if (o.personaId !== personaId) continue;
    grupos.set(o.hasta, [...(grupos.get(o.hasta) ?? []), o]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hasta, os]) => ({
      hasta,
      hechos: os.filter((o) => o.hechoEn !== null).length,
      objetivos: [...os].sort((a, b) => Number(a.hechoEn !== null) - Number(b.hechoEn !== null)),
    }));
}

/** «31 de diciembre de 2026». */
export function plazoLargo(f: FechaIso): string {
  const [a, m, d] = f.split("-").map(Number) as [number, number, number];
  return `${d} de ${NOMBRE_MES[m - 1]} de ${a}`;
}

/** «quedan 42 días», «queda 1 día», «quedan 4 meses», «venció hace 3 días», «es hoy». */
export function cuantoQueda(hasta: FechaIso, hoy: FechaIso): string {
  const d = diasEntre(hoy, hasta);
  if (d === 0) return "es hoy";
  if (d === 1) return "queda 1 día";
  if (d > 1 && d <= 60) return `quedan ${d} días`;
  if (d > 60) return `quedan ${Math.round(d / 30)} meses`;
  const atras = -d;
  if (atras === 1) return "venció ayer";
  return atras <= 60 ? `venció hace ${atras} días` : `venció hace ${Math.round(atras / 30)} meses`;
}

/** El texto de un siguiente paso: lo mismo que un objetivo (una línea corta). */
export function validarPaso(
  t: string,
): { ok: true; texto: string } | { ok: false; motivo: string } {
  const x = limpiar(t);
  if (x === "" || x.length > MAX_TEXTO_OBJETIVO) {
    return { ok: false, motivo: `Escribe el paso (hasta ${MAX_TEXTO_OBJETIVO} letras).` };
  }
  return { ok: true, texto: x };
}

/** Cuántos días lleva sin avanzar: desde el último paso o, si no lo hubo, desde que se apuntó. */
export const diasSinMoverse = (o: Objetivo, hoy: FechaIso): number =>
  Math.max(0, diasEntre(o.movidoEn ?? o.creadoEn, hoy));

/** Los que se repiten y ya toca hacerlos (o van tarde), el que más lleva, primero. */
export function quePideHacer(
  objetivos: readonly Objetivo[],
  personaId: string,
  hoy: FechaIso,
): Array<{ objetivo: Objetivo; dias: number }> {
  return objetivos
    .filter((o) => o.personaId === personaId && o.hechoEn === null && o.cada !== null)
    .map((o) => ({ objetivo: o, dias: diasSinMoverse(o, hoy) }))
    .filter((x) => x.dias >= (x.objetivo.cada ?? Number.POSITIVE_INFINITY))
    .sort((a, b) => b.dias - a.dias);
}

/** Los que no se repiten, siguen en marcha y llevan dos semanas sin moverse, el más parado, primero. */
export function parados(
  objetivos: readonly Objetivo[],
  personaId: string,
  hoy: FechaIso,
): Array<{ objetivo: Objetivo; dias: number }> {
  return objetivos
    .filter((o) => o.personaId === personaId && o.hechoEn === null && o.cada === null)
    .map((o) => ({ objetivo: o, dias: diasSinMoverse(o, hoy) }))
    .filter((x) => x.dias >= DIAS_PARADO)
    .sort((a, b) => b.dias - a.dias);
}

/** Cuántos objetivos en marcha no tienen todavía un siguiente paso. */
export const sinPaso = (objetivos: readonly Objetivo[], personaId: string): number =>
  objetivos.filter((o) => o.personaId === personaId && o.hechoEn === null && o.siguiente === null)
    .length;

/** «hace 3 semanas», «hace 10 días», «hoy». */
export function haceCuanto(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  return `hace ${Math.floor(dias / 30)} meses`;
}
