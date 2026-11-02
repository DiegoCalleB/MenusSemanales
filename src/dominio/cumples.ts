import { type FechaIso, diasEntre } from "./fechas";

/**
 * Cumpleaños de la familia, los amigos y el cole, y los avisos para ir pensando en el regalo con
 * tiempo. La app calcula cuándo toca pensar, comprar y entregar; así nadie tiene que acordarse
 * (D-068). Las fechas se guardan como día y mes (y el año de nacimiento, si se sabe, para la edad).
 */

export type Relacion = "familia" | "amigo" | "cole" | "otro";
export type EstadoRegalo = "sin-pensar" | "idea" | "comprado" | "entregado";

export interface Cumple {
  id: string;
  nombre: string;
  dia: number;
  mes: number;
  /** Año de nacimiento, para saber qué edad cumple. */
  anio?: number | null;
  relacion: Relacion;
  /** Persona del hogar a la que corresponde (para no enseñarle a ella su sorpresa). */
  personaId?: string | null;
  /** A quién le toca pensar el regalo; vacío = a los adultos del hogar. */
  interesados?: string[];
  /** Cosas que le gustan, para proponer ideas. */
  gustos?: string[];
  ideas: string[];
  /** Estado del regalo del año `anioEstado`; en otro año vuelve a «sin pensar». */
  estado: EstadoRegalo;
  anioEstado?: number | null;
}

const bisiesto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

/** Fecha de ese año; el 29 de febrero cae el 28 en los años que no son bisiestos. */
export function fechaEnAnio(anio: number, mes: number, dia: number): FechaIso {
  const d = mes === 2 && dia === 29 && !bisiesto(anio) ? 28 : dia;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Próxima vez que cae el cumpleaños desde `hoy` (hoy incluido). */
export function proximaFecha(c: Pick<Cumple, "dia" | "mes">, hoy: FechaIso): FechaIso {
  const anio = Number(hoy.slice(0, 4));
  const este = fechaEnAnio(anio, c.mes, c.dia);
  return este >= hoy ? este : fechaEnAnio(anio + 1, c.mes, c.dia);
}

export const diasHasta = (c: Pick<Cumple, "dia" | "mes">, hoy: FechaIso): number =>
  diasEntre(hoy, proximaFecha(c, hoy));

/** Edad que cumple en la próxima celebración, si se conoce el año de nacimiento. */
export function edadQueCumple(
  c: Pick<Cumple, "dia" | "mes" | "anio">,
  hoy: FechaIso,
): number | null {
  if (!c.anio) return null;
  return Number(proximaFecha(c, hoy).slice(0, 4)) - c.anio;
}

/** Estado del regalo para la próxima celebración: si el guardado es de otro año, empieza de cero. */
export function estadoVigente(c: Cumple, hoy: FechaIso): EstadoRegalo {
  const anio = Number(proximaFecha(c, hoy).slice(0, 4));
  return c.anioEstado === anio ? c.estado : "sin-pensar";
}

export type Urgencia = "hoy" | "esta-semana" | "comprar" | "pensar" | "lejos";

/** Cuándo conviene actuar: pensar a 30 días, comprar a 14, esta semana a 7. */
export function urgenciaDe(dias: number): Urgencia {
  if (dias === 0) return "hoy";
  if (dias <= 7) return "esta-semana";
  if (dias <= 14) return "comprar";
  if (dias <= 30) return "pensar";
  return "lejos";
}

export const TEXTO_URGENCIA: Record<Exclude<Urgencia, "lejos">, string> = {
  hoy: "¡Es hoy!",
  "esta-semana": "Esta semana: que no se os pase el regalo",
  comprar: "Hay que comprar el regalo",
  pensar: "Empezad a pensar el regalo",
};

export interface AvisoCumple {
  cumple: Cumple;
  fecha: FechaIso;
  dias: number;
  edad: number | null;
  urgencia: Exclude<Urgencia, "lejos">;
  estado: EstadoRegalo;
}

/**
 * Los cumpleaños que ya hay que mirar (a menos de un mes), del más cercano al más lejano. Si el
 * regalo ya está comprado o entregado, deja de avisar (salvo el propio día).
 */
export function avisosDeCumples(
  cumples: readonly Cumple[],
  hoy: FechaIso,
  dias = 30,
): AvisoCumple[] {
  const avisos: AvisoCumple[] = [];
  for (const cumple of cumples) {
    const d = diasHasta(cumple, hoy);
    const urgencia = urgenciaDe(d);
    if (urgencia === "lejos" || d > dias) continue;
    const estado = estadoVigente(cumple, hoy);
    if ((estado === "comprado" || estado === "entregado") && d > 0) continue;
    avisos.push({
      cumple,
      fecha: proximaFecha(cumple, hoy),
      dias: d,
      edad: edadQueCumple(cumple, hoy),
      urgencia,
      estado,
    });
  }
  return avisos.sort(
    (a, b) => a.dias - b.dias || a.cumple.nombre.localeCompare(b.cumple.nombre, "es"),
  );
}

/**
 * Lee fechas escritas a mano: «12/3», «12/03/2017», «12-3-17» o «5 de septiembre de 2020».
 * Devuelve null si no es una fecha válida.
 */
export function parsearFecha(
  texto: string,
): { dia: number; mes: number; anio: number | null } | null {
  const t = texto.trim().toLowerCase();
  let dia: number;
  let mes: number;
  let anio: number | null = null;
  const num = /^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/.exec(t);
  const MESES = [
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
  const largo = /^(\d{1,2}) de ([a-záéíóú]+)(?: de (\d{4}))?$/.exec(t);
  if (num) {
    dia = Number(num[1]);
    mes = Number(num[2]);
    if (num[3]) anio = num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3]);
  } else if (largo) {
    dia = Number(largo[1]);
    mes = MESES.indexOf((largo[2] ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")) + 1;
    if (largo[3]) anio = Number(largo[3]);
  } else return null;
  if (mes < 1 || mes > 12 || dia < 1) return null;
  const maxDia = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1] as number;
  if (dia > maxDia) return null;
  if (anio !== null && (anio < 1900 || anio > 2100)) return null;
  return { dia, mes, anio };
}

/** «Alba 12/3/2017» → { nombre: «Alba», dia: 12, mes: 3, anio: 2017 }. Una persona por línea o separada por coma o «;». */
export function parsearCumples(texto: string): {
  validos: Array<{ nombre: string; dia: number; mes: number; anio: number | null }>;
  erroneos: string[];
} {
  const validos: Array<{ nombre: string; dia: number; mes: number; anio: number | null }> = [];
  const erroneos: string[] = [];
  for (const linea of texto.split(/[\n;]/).flatMap((l) => l.split(/,(?=\s*[\p{L}])/u))) {
    const l = linea.trim();
    if (l === "") continue;
    const m =
      /^(.*?)[\s:–-]+(\d{1,2}(?:[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?| de [\p{L}]+(?: de \d{4})?))$/u.exec(
        l,
      );
    const fecha = m ? parsearFecha(m[2] ?? "") : null;
    const nombre = (m?.[1] ?? "").trim();
    if (!m || !fecha || nombre === "" || nombre.length > 60) erroneos.push(l);
    else validos.push({ nombre, ...fecha });
  }
  return { validos, erroneos };
}

export interface Felicitacion {
  cumple: Cumple;
  edad: number | null;
  /** Lo que se le dice a quien cumple. */
  paraEl: string;
  /** Lo que se les dice a los demás para que no se les olvide felicitar. */
  paraLosDemas: string;
  /** Mensaje listo para mandar por WhatsApp. */
  mensaje: string;
}

/** Quién cumple hoy y qué decirle: la app felicita y recuerda felicitar (D-070). */
export function felicitacionesDeHoy(cumples: readonly Cumple[], hoy: FechaIso): Felicitacion[] {
  return cumples
    .filter((c) => diasHasta(c, hoy) === 0)
    .map((cumple) => {
      const edad = edadQueCumple(cumple, hoy);
      const cuantos = edad !== null ? ` ${edad} añitos` : "";
      return {
        cumple,
        edad,
        paraEl: `¡Feliz cumpleaños, ${cumple.nombre}!${edad !== null ? ` Hoy cumples ${edad}.` : ""} Hoy es tu día: que te mimen mucho. 🎉`,
        paraLosDemas: `Hoy es el cumple de ${cumple.nombre}${edad !== null ? ` (${edad})` : ""}. ¡No os olvidéis de felicitarle!`,
        mensaje: `🎂 ¡Felicidades, ${cumple.nombre}! Que cumplas${cuantos} muy feliz y que te quieran muchísimo. 🎉🥳`,
      };
    })
    .sort((a, b) => a.cumple.nombre.localeCompare(b.cumple.nombre, "es"));
}
