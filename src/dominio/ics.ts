import { type FechaIso, diasEntre, sumarDias } from "./fechas";

/**
 * Lector de calendarios iCal (.ics), el formato del «enlace secreto» de Google Calendar (D-074).
 * Solo lo necesario para una cuenta atrás: título y día de cada evento, con las repeticiones más
 * habituales (diaria, semanal, mensual, anual) y las excepciones. No pretende ser un lector completo.
 */

export interface EventoExterno {
  fecha: FechaIso;
  titulo: string;
  /** «18:30» en hora de Madrid, o null si dura todo el día. */
  hora: string | null;
}

interface Crudo {
  uid: string;
  titulo: string;
  inicio: { fecha: FechaIso; hora: string | null };
  fin: FechaIso | null;
  regla: Record<string, string> | null;
  excepciones: Set<FechaIso>;
  recurrenciaDe: FechaIso | null;
  cancelado: boolean;
}

const ZONA = "Europe/Madrid";
const formato = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const desescapar = (t: string) =>
  t
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

/** Une las líneas que el formato parte con un espacio al principio. */
const desplegar = (texto: string) => texto.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);

function fechaYHora(
  parametros: string,
  valor: string,
): { fecha: FechaIso; hora: string | null } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(valor.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (h === undefined || parametros.includes("VALUE=DATE"))
    return { fecha: `${y}-${mo}-${d}`, hora: null };
  if (z) {
    // Hora universal: se pasa a la hora de Madrid (el día puede cambiar).
    const instante = new Date(
      Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)),
    );
    const [dia, hora] = formato.format(instante).split(" ");
    return { fecha: dia as FechaIso, hora: (hora ?? "").slice(0, 5) };
  }
  return { fecha: `${y}-${mo}-${d}`, hora: `${h}:${mi}` };
}

function leerEventos(texto: string): Crudo[] {
  const lineas = desplegar(texto);
  const eventos: Crudo[] = [];
  let actual: Crudo | null = null;
  for (const linea of lineas) {
    if (linea === "BEGIN:VEVENT") {
      actual = {
        uid: "",
        titulo: "",
        inicio: { fecha: "", hora: null },
        fin: null,
        regla: null,
        excepciones: new Set(),
        recurrenciaDe: null,
        cancelado: false,
      };
      continue;
    }
    if (linea === "END:VEVENT") {
      if (actual && actual.inicio.fecha) eventos.push(actual);
      actual = null;
      continue;
    }
    if (!actual) continue;
    const dos = linea.indexOf(":");
    if (dos < 0) continue;
    const [nombre = "", ...params] = linea.slice(0, dos).split(";");
    const valor = linea.slice(dos + 1);
    const parametros = params.join(";");
    switch (nombre.toUpperCase()) {
      case "UID":
        actual.uid = valor;
        break;
      case "SUMMARY":
        actual.titulo = desescapar(valor);
        break;
      case "STATUS":
        actual.cancelado = valor.toUpperCase() === "CANCELLED";
        break;
      case "DTSTART": {
        const f = fechaYHora(parametros, valor);
        if (f) actual.inicio = f;
        break;
      }
      case "DTEND": {
        const f = fechaYHora(parametros, valor);
        // En los eventos de día completo el fin es exclusivo: el último día es el anterior.
        if (f) actual.fin = f.hora === null ? sumarDias(f.fecha, -1) : f.fecha;
        break;
      }
      case "RRULE":
        actual.regla = Object.fromEntries(
          valor.split(";").map((p) => p.split("=") as [string, string]),
        );
        break;
      case "EXDATE":
        for (const v of valor.split(",")) {
          const f = fechaYHora(parametros, v);
          if (f) actual.excepciones.add(f.fecha);
        }
        break;
      case "RECURRENCE-ID": {
        const f = fechaYHora(parametros, valor);
        if (f) actual.recurrenciaDe = f.fecha;
        break;
      }
    }
  }
  return eventos;
}

const DIAS_SEMANA = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const diaSemana = (f: FechaIso) =>
  DIAS_SEMANA[(new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7] as string;

/** Fechas en las que cae un evento dentro de [desde, hasta], contando sus repeticiones. */
function ocurrencias(e: Crudo, desde: FechaIso, hasta: FechaIso): FechaIso[] {
  const primera = e.inicio.fecha;
  const duracion = e.fin && e.fin > primera ? diasEntre(primera, e.fin) : 0;
  const salida: FechaIso[] = [];
  const dentro = (f: FechaIso) => {
    // Un evento de varios días sale una sola vez: el primer día que queda dentro del rango.
    for (let i = 0; i <= duracion; i++) {
      const dia = sumarDias(f, i);
      if (dia >= desde && dia <= hasta && !e.excepciones.has(f)) {
        salida.push(dia);
        return;
      }
    }
  };
  if (!e.regla) {
    dentro(primera);
    return salida;
  }
  const r = e.regla;
  const paso = Math.max(1, Number(r.INTERVAL ?? 1));
  const limite = r.UNTIL ? (fechaYHora("", r.UNTIL)?.fecha ?? hasta) : hasta;
  const maxN = r.COUNT ? Number(r.COUNT) : Infinity;
  const tope = limite < hasta ? limite : hasta;
  const [ya, ma, da] = primera.split("-").map(Number) as [number, number, number];
  let n = 0;
  const dias = r.BYDAY ? r.BYDAY.split(",").map((x) => x.slice(-2)) : [diaSemana(primera)];
  // Recorrido día a día (como mucho unos pocos cientos de días por evento).
  for (let f = primera; f <= tope && n < maxN; f = sumarDias(f, 1)) {
    const k = diasEntre(primera, f);
    const [y, m, d] = f.split("-").map(Number) as [number, number, number];
    let toca = false;
    switch (r.FREQ) {
      case "DAILY":
        toca = k % paso === 0;
        break;
      case "WEEKLY":
        toca = Math.floor(k / 7) % paso === 0 && dias.includes(diaSemana(f));
        break;
      case "MONTHLY":
        toca = d === da && ((y - ya) * 12 + (m - ma)) % paso === 0;
        break;
      case "YEARLY":
        toca = d === da && m === ma && (y - ya) % paso === 0;
        break;
      default:
        return salida;
    }
    if (!toca) continue;
    n++;
    if (f >= sumarDias(desde, -duracion)) dentro(f);
  }
  return salida;
}

/**
 * Eventos del calendario entre `desde` y `hasta` (ambos incluidos), ordenados. Las modificaciones
 * de un día suelto sustituyen a la repetición y los cancelados no salen.
 */
export function parsearIcs(texto: string, desde: FechaIso, hasta: FechaIso): EventoExterno[] {
  const crudos = leerEventos(texto);
  const movidos = new Set(
    crudos.filter((e) => e.recurrenciaDe).map((e) => `${e.uid}|${e.recurrenciaDe}`),
  );
  const eventos: EventoExterno[] = [];
  for (const e of crudos) {
    if (e.cancelado || e.titulo === "") continue;
    if (!e.recurrenciaDe)
      for (const x of [...movidos])
        if (x.startsWith(`${e.uid}|`)) e.excepciones.add(x.split("|")[1] as FechaIso);
    for (const fecha of ocurrencias(e, desde, hasta)) {
      eventos.push({ fecha, titulo: e.titulo, hora: e.inicio.hora });
    }
  }
  return eventos.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      (a.hora ?? "").localeCompare(b.hora ?? "") ||
      a.titulo.localeCompare(b.titulo, "es"),
  );
}
