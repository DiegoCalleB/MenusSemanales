import {
  type CalendarioLeido,
  type CursoEscolar,
  calendarioConocidoHasta,
  cursoDesdeLeido,
  cursosConocidos,
  diasLectivos,
  validarCurso,
} from "@/dominio/calendario-escolar";
import type { FechaIso } from "@/dominio/fechas";
import { type EnlacesDelCurso, enlacesDelCurso } from "@/dominio/web-calendario-escolar";

/**
 * La comprobación mensual del calendario escolar (D-146). Para el curso siguiente al último
 * conocido (y para los leídos que aún no han acabado, por si la Comunidad los actualiza):
 *   1. busca sus PDF en la web de la Comunidad de Madrid;
 *   2. los lee DOS veces con IA, por separado;
 *   3. solo si las dos lecturas dan exactamente los mismos días, y el curso pasa `validarCurso`,
 *      lo guarda (si ha cambiado).
 * Si algo falla, no se guarda nada: la app sigue avisando todos los días de lunes a viernes, que
 * es lo seguro, y se vuelve a intentar el mes siguiente.
 */

export interface Dependencias {
  hoy: FechaIso;
  /** El HTML de la página del calendario escolar. */
  pagina: () => Promise<string>;
  /** Un PDF en base64 (o null si no se pudo bajar o no es un PDF). */
  pdf: (url: string) => Promise<string | null>;
  leer: (anio: number, pdfs: readonly string[]) => Promise<CalendarioLeido | null>;
  guardar: (anio: number, curso: CursoEscolar, huella: string) => Promise<string | null>;
  huella: (texto: string) => string;
}

export type ResultadoCurso =
  | { anio: number; estado: "sin-publicar" }
  | { anio: number; estado: "sin-descargar" }
  | { anio: number; estado: "no-leido" }
  | { anio: number; estado: "lecturas-distintas" }
  | { anio: number; estado: "no-valido"; errores: string[] }
  | { anio: number; estado: "nuevo" | "cambiado" | "igual"; curso: CursoEscolar }
  | { anio: number; estado: "fallo" };

/** Qué cursos mirar: el siguiente al último conocido y los leídos que no han acabado. */
export function cursosAComprobar(hoy: FechaIso): number[] {
  const siguiente = Number(calendarioConocidoHasta().slice(0, 4));
  const anios = new Set<number>([siguiente]);
  for (const c of cursosConocidos()) {
    if (c.fuente.startsWith("Leído") && c.fin >= hoy) anios.add(Number(c.inicio.slice(0, 4)));
  }
  return [...anios].sort((a, b) => a - b);
}

/** Lo que tiene que coincidir entre las dos lecturas: los días, no cómo se escribe el motivo. */
const firma = (c: CursoEscolar) =>
  JSON.stringify({ lectivos: diasLectivos(c), tramos: c.sinCole.map((t) => [t.desde, t.hasta]) });

export async function comprobarCurso(
  anio: number,
  html: string,
  d: Dependencias,
): Promise<ResultadoCurso> {
  const enlaces: EnlacesDelCurso = enlacesDelCurso(html, anio);
  const urls = [enlaces.orden, enlaces.cuadro].filter((u): u is string => u !== null);
  // Sin la orden del BOCM no se da por publicado (el cuadro solo es un resumen).
  if (!enlaces.orden) return { anio, estado: "sin-publicar" };
  const pdfs = (await Promise.all(urls.map((u) => d.pdf(u)))).filter(
    (p): p is string => p !== null,
  );
  if (pdfs.length === 0) return { anio, estado: "sin-descargar" };

  const [a, b] = await Promise.all([d.leer(anio, pdfs), d.leer(anio, pdfs)]);
  if (!a || !b) return { anio, estado: "no-leido" };
  const fuente = `Leído de la web de la Comunidad de Madrid (${urls.length === 2 ? "orden del BOCM y cuadro resumen" : "orden del BOCM"}) el ${d.hoy}`;
  const ca = cursoDesdeLeido(a, fuente);
  const cb = cursoDesdeLeido(b, fuente);
  if (Number(ca.inicio.slice(0, 4)) !== anio) {
    return {
      anio,
      estado: "no-valido",
      errores: [`El documento es de otro curso (${ca.inicio}).`],
    };
  }
  if (firma(ca) !== firma(cb)) return { anio, estado: "lecturas-distintas" };
  const errores = validarCurso(ca);
  if (errores.length > 0) return { anio, estado: "no-valido", errores };
  const estado = await d.guardar(anio, ca, d.huella(firma(ca)));
  if (estado !== "nuevo" && estado !== "cambiado" && estado !== "igual") {
    return { anio, estado: "fallo" };
  }
  return { anio, estado, curso: ca };
}

export async function comprobarCalendarioEscolar(d: Dependencias): Promise<ResultadoCurso[]> {
  const anios = cursosAComprobar(d.hoy);
  let html: string;
  try {
    html = await d.pagina();
  } catch {
    return anios.map((anio) => ({ anio, estado: "sin-descargar" as const }));
  }
  const out: ResultadoCurso[] = [];
  for (const anio of anios) {
    try {
      out.push(await comprobarCurso(anio, html, d));
    } catch {
      out.push({ anio, estado: "fallo" });
    }
  }
  return out;
}

/** Una línea para la app: «2027/2028: nuevo» o «2027/2028: aún no publicado». */
export function resumenDeComprobacion(r: readonly ResultadoCurso[]): string {
  const texto: Record<ResultadoCurso["estado"], string> = {
    "sin-publicar": "aún no publicado",
    "sin-descargar": "no se pudo descargar",
    "no-leido": "no se pudo leer",
    "lecturas-distintas": "dos lecturas no coincidían; se reintenta el mes que viene",
    "no-valido": "lo leído no cuadra; se reintenta el mes que viene",
    nuevo: "cargado",
    cambiado: "actualizado",
    igual: "sin cambios",
    fallo: "falló; se reintenta el mes que viene",
  };
  return r
    .map((x) => `Curso ${x.anio}/${x.anio + 1}: ${texto[x.estado]}`)
    .join(" · ")
    .slice(0, 300);
}
