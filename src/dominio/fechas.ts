/** Fechas como cadenas ISO `YYYY-MM-DD`, sin zona horaria: el dominio no depende del reloj ni de Date.now(). */

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 86_400_000;

export type FechaIso = string;

function aFecha(iso: FechaIso): Date {
  if (!FORMATO.test(iso)) throw new RangeError(`Fecha no válida: "${iso}" (se espera AAAA-MM-DD)`);
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(a, m - 1, d));
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) {
    throw new RangeError(`Fecha no válida: "${iso}"`);
  }
  return fecha;
}

export function sumarDias(iso: FechaIso, dias: number): FechaIso {
  return new Date(aFecha(iso).getTime() + dias * MS_DIA).toISOString().slice(0, 10);
}

/** 1 = lunes ... 7 = domingo (ISO 8601, igual que `patron_asistencia.dia_semana`). */
export function diaSemanaIso(iso: FechaIso): number {
  const d = aFecha(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Semana de lunes a domingo que contiene la fecha. */
export function semanaDe(iso: FechaIso): { desde: FechaIso; hasta: FechaIso } {
  const desde = sumarDias(iso, 1 - diaSemanaIso(iso));
  return { desde, hasta: sumarDias(desde, 6) };
}

export function enRango(iso: FechaIso, desde: FechaIso, hasta: FechaIso): boolean {
  return iso >= desde && iso <= hasta; // el formato ISO se ordena como texto
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: FechaIso, hasta: FechaIso): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / MS_DIA);
}
