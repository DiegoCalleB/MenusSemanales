import { z } from "zod";
import { proximaVez } from "./casa";
import type { EventoCalendario } from "./compartir";
import { proximaFecha } from "./cumples";
import { type FechaIso, diaSemanaIso, sumarDias } from "./fechas";
import { NOMBRE_DIA_LARGO, preparacionesEntre } from "./mochila";
import { MAX_LARGO_MOTIVO, consultaCole, diaDeCole, tramosSinCole } from "./calendario-escolar";
import { fechaLarga, lineasDelTiempo } from "./avisos";
import { LUGAR_TIEMPO, type Pronostico } from "./tiempo";
import { type PlanBarrio } from "./barrio";
import {
  type EventoEstadio,
  planesDelDia,
  queEs,
  textoDelEvento,
  tituloCortoDelEvento,
} from "./metropolitano";

/**
 * Avisos fuera de la app (D-083): el calendario del móvil se suscribe a un enlace y avisa solo.
 * Aquí se convierte el resumen que devuelve la base de datos en eventos con alarma. Sin red ni
 * base de datos: recibe el resumen y la fecha de hoy.
 */

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texto = z.string().min(1).max(200);

/** Lo único que sale de la base de datos para el calendario: ni ideas de regalos, ni compra, ni despensa. */
export const proyeccionSchema = z.object({
  personas: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      tipo: z.enum(["adulto", "nino"]),
      activa: z.boolean(),
    }),
  ),
  cenas: z.array(z.object({ fecha, nombre: texto })),
  almuerzos: z.array(z.object({ fecha, texto })),
  eventos: z.record(fecha, z.object({ titulo: texto, emoji: z.string().max(16) })),
  agenda: z.array(
    z.object({
      fecha,
      hasta: fecha.nullable(),
      hora: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .nullable(),
      titulo: texto,
    }),
  ),
  casa: z.array(
    z.object({
      titulo: texto,
      emoji: z.string().max(16),
      cadaDias: z.number().int().min(1),
      responsableId: z.string().nullable(),
      ultimaVez: fecha.nullable(),
      desde: fecha,
      aplazadaHasta: fecha.nullish(),
    }),
  ),
  /** Menú del cole (D-141), solo los platos. Opcional: la función SQL anterior no lo manda. */
  cole: z
    .array(
      z.object({
        fecha,
        primero: z.string().max(200).nullish(),
        segundo: z.string().max(200).nullish(),
        postre: z.string().max(200).nullish(),
      }),
    )
    .catch([])
    .optional(),
  /** Qué llevar (D-136). Opcional: la función SQL anterior no lo manda. */
  mochila: z
    .array(
      z.object({
        personaId: z.string(),
        texto,
        dias: z.array(z.number().int().min(1).max(7)).catch([]),
        fecha: fecha.nullish().catch(null),
        antes: z.number().int().min(0).max(7).catch(1),
        /** Solo con cole (D-144). Si falta (documento antiguo), sí: era todo del cole. */
        soloConCole: z.boolean().catch(true).optional(),
      }),
    )
    .catch([])
    .optional(),
  /** Medicación (D-166), solo para los avisos del servidor. Opcional: la SQL anterior no la manda. */
  medicacion: z
    .array(
      z.object({
        personaId: z.string(),
        nombre: z.string().trim().min(1).max(60),
        hora: z.number().int().min(0).max(23),
        dias: z.array(z.number().int().min(1).max(7)).catch([]),
        tomadas: z.array(fecha).catch([]),
      }),
    )
    .catch([])
    .optional(),
  /** Cuidarse (D-183): solo de quien pidió avisos, y solo agua y ejercicio (nunca los hábitos). */
  cuidado: z
    .array(
      z.object({
        personaId: z.string(),
        metaAgua: z.number().int().min(1).max(20).catch(8),
        avisos: z.boolean().catch(false),
        /** Qué avisos y a qué horas (D-204): solo interruptores y horas. */
        cfg: z.unknown().optional(),
        miDia: z
          .object({ hora: z.number().int().min(0).max(23), total: z.number().int().min(0).max(30) })
          .nullable()
          .catch(null),
        ejercicio: z
          .object({
            nombre: z.string().trim().min(1).max(60),
            dias: z.array(z.number().int().min(1).max(7)).catch([]),
          })
          .nullable()
          .catch(null),
        dias: z
          .array(
            z.object({
              fecha,
              agua: z.number().int().min(0).max(30).catch(0),
              ejercicio: z.boolean().catch(false),
              lista: z.number().int().min(0).max(30).catch(0),
            }),
          )
          .catch([]),
      }),
    )
    .catch([])
    .optional(),
  /** Objetivos y notas (D-203): solo cuántos por persona, nunca el texto. Opcional. */
  objetivos: z
    .array(
      z.object({
        personaId: z.string(),
        tocan: z.number().int().min(0).max(300).catch(0),
        parados: z.number().int().min(0).max(300).catch(0),
        bandeja: z.number().int().min(0).max(400).catch(0),
      }),
    )
    .catch([])
    .optional(),
  /** Pendientes sin fecha (D-175), solo para el recordatorio del domingo. Opcional. */
  pendientes: z
    .array(
      z.object({
        texto: z.string().trim().min(1).max(120),
        personaId: z.string().nullable().catch(null),
        importante: z.boolean().catch(false),
        creadoEn: fecha,
        hechoEn: fecha.nullable().catch(null),
      }),
    )
    .catch([])
    .optional(),
  /** Papeles y vencimientos (D-174). Opcional: la SQL anterior no los manda. */
  vencimientos: z
    .array(
      z.object({
        titulo: z.string().trim().min(1).max(80),
        categoria: z.string().catch("otro"),
        personaId: z.string().nullable().catch(null),
        fecha,
        avisos: z.array(z.number().int().min(0).max(120)).catch([]),
        hechoEn: fecha.nullable().catch(null),
      }),
    )
    .catch([])
    .optional(),
  /** Lo que apunta la familia sobre el calendario escolar (D-144). Opcional: la SQL anterior no lo manda. */
  diasCole: z
    .array(
      z.object({
        fecha,
        hay: z.boolean(),
        motivo: z.string().max(MAX_LARGO_MOTIVO).catch(""),
      }),
    )
    .catch([])
    .optional(),
  cumples: z.array(
    z.object({
      nombre: texto,
      dia: z.number().int().min(1).max(31),
      mes: z.number().int().min(1).max(12),
      anio: z.number().int().nullish(),
      personaId: z.string().nullish(),
    }),
  ),
});
export type ProyeccionCalendario = z.infer<typeof proyeccionSchema>;

/** A qué hora sale en el calendario el recordatorio de dejar preparada la mochila (alarma una hora antes). */
export const HORA_MOCHILA = "20:00";
/** Cuántos días por delante se ponen los recordatorios de la mochila. */
const DIAS_MOCHILA = 56;
/** Cuántos días por delante se ponen los días sin cole (lo que queda de curso y el verano). */
const DIAS_SIN_COLE = 300;
const minuscula = (t: string) => `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
/** Desde estos días seguidos sin cole, un periodo es «largo»: solo se marcan su inicio y su fin. */
const DIAS_PERIODO_LARGO = 5;

/**
 * El motivo de un día sin cole, corto para el título (D-161): «: Navidad», «: Constitución». Los
 * genéricos («Día no lectivo») no dicen nada y se quedan en la descripción.
 */
function motivoCorto(motivo: string): string {
  const m = motivo
    .replace(/^(vacaciones de |día de la |día del |día de )/i, "")
    .replace(/\s*\(fiesta local\)$/i, "")
    .trim();
  if (m === "" || /^(día no lectivo|no lectivo|no hay cole)$/i.test(m)) return "";
  return `: ${m.charAt(0).toUpperCase()}${m.slice(1)}`;
}

/** A qué hora salen en el calendario las comidas y cenas (no llevan hora propia en la app). */
export const HORA_COMIDA = "14:00";
/** La comida del cole (D-141), un poco antes que la de casa. */
export const HORA_COLE = "13:00";
/** Entre semana se cena antes (20:00); sábados y domingos, a las 21:00. */
export const HORA_CENA_SEMANA = "20:00";
export const HORA_CENA = "21:00";

/** ¿Es sábado o domingo? (`AAAA-MM-DD`, sin depender de la zona horaria). */
const esFinDeSemana = (f: string) => [0, 6].includes(new Date(`${f}T12:00:00Z`).getUTCDay());

const limpio = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/**
 * Eventos del calendario suscrito de una persona (`para`). Lleva sus tareas de casa y las de «los
 * dos», las cenas y comidas, las fechas y los cumpleaños, con alarma a las 9:00 (o una hora antes
 * si el evento tiene hora). Los cumpleaños salen solo el día del cumple, con su tarta: sin avisos de
 * «pensar» ni «comprar» el regalo (D-143; siguen en la app).
 */
/** Qué calendario se pide (D-140): las fechas (lo de no olvidar) o solo las comidas y cenas. */
export type CalendarioSuscrito = "fechas" | "comidas" | "metropolitano" | "barrio";

const esComida = (e: EventoCalendario) => /^(cena|comida|cole)-/.test(e.uid ?? "");
/** Los partidos y conciertos del estadio (D-163): su propio calendario. Los avisos de choque no. */
const esEstadio = (e: EventoCalendario) => /^estadio-/.test(e.uid ?? "");
/** Los planes del barrio (D-165): su propio calendario. */
const esBarrio = (e: EventoCalendario) => /^barrio-/.test(e.uid ?? "");

/**
 * Los eventos de uno de los dos calendarios suscritos (D-140): «fechas» (citas, fechas señaladas,
 * cumpleaños y regalos, casa y mochila) o «comidas» (comidas y cenas). Separados, en Google cada uno
 * tiene su color y se puede ocultar.
 */
export function eventosSuscritos(
  p: ProyeccionCalendario,
  opciones: {
    hoy: FechaIso;
    para: string | null;
    solo?: CalendarioSuscrito;
    /** La previsión del tiempo (D-154), si se pudo leer: el paraguas y el abrigo, en «fechas». */
    tiempo?: readonly Pronostico[];
    /** Partidos y conciertos en el estadio de al lado (D-159), en su propio calendario. */
    estadio?: readonly EventoEstadio[];
    /** Los planes del barrio (D-165), en su propio calendario. */
    barrio?: readonly PlanBarrio[];
  },
): EventoCalendario[] {
  const todos = todosLosEventos(p, opciones);
  if (opciones.solo === "comidas") return todos.filter(esComida);
  if (opciones.solo === "metropolitano") return todos.filter(esEstadio);
  if (opciones.solo === "barrio") return todos.filter(esBarrio);
  return todos.filter((e) => !esComida(e) && !esEstadio(e) && !esBarrio(e));
}

function todosLosEventos(
  p: ProyeccionCalendario,
  {
    hoy,
    para,
    tiempo = [],
    estadio = [],
    barrio = [],
  }: {
    hoy: FechaIso;
    para: string | null;
    tiempo?: readonly Pronostico[];
    estadio?: readonly EventoEstadio[];
    barrio?: readonly PlanBarrio[];
  },
): EventoCalendario[] {
  const eventos: EventoCalendario[] = [];
  const persona = p.personas.find((x) => x.id === para && x.activa) ?? null;

  const porFecha = (items: ReadonlyArray<{ fecha: FechaIso; texto: string }>) => {
    const m = new Map<FechaIso, string[]>();
    for (const i of items) if (i.fecha >= hoy) m.set(i.fecha, [...(m.get(i.fecha) ?? []), i.texto]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  for (const [f, platos] of porFecha(p.cenas.map((c) => ({ fecha: c.fecha, texto: c.nombre })))) {
    eventos.push({
      uid: `cena-${f}`,
      fecha: f,
      titulo: `🍽️ ${platos.join(" + ")}`,
      descripcion: `Platos: ${platos.join(", ")}`,
      hora: esFinDeSemana(f) ? HORA_CENA : HORA_CENA_SEMANA,
    });
  }
  for (const [f, textos] of porFecha(p.almuerzos)) {
    eventos.push({
      uid: `comida-${f}`,
      fecha: f,
      titulo: `☀️ ${textos.join(" + ")}`,
      descripcion: `Comida: ${textos.join(", ")}`,
      hora: HORA_COMIDA,
    });
  }
  // Menú del cole (D-141): primero y segundo en el título; el postre, en la descripción.
  for (const c of p.cole ?? []) {
    if (c.fecha < hoy) continue;
    const platos = [c.primero, c.segundo].filter((x): x is string => Boolean(x && x.trim()));
    if (platos.length === 0) continue;
    eventos.push({
      uid: `cole-${c.fecha}`,
      fecha: c.fecha,
      titulo: `🏫 ${platos.join(" · ")}`,
      descripcion: `Comida del cole: ${platos.join(", ")}${c.postre ? `. Postre: ${c.postre}` : ""}`,
      hora: HORA_COLE,
    });
  }
  for (const [f, ev] of Object.entries(p.eventos).sort(([a], [b]) => a.localeCompare(b))) {
    if (f < hoy) continue;
    eventos.push({
      uid: `evento-${f}`,
      fecha: f,
      titulo: `${ev.emoji} ${ev.titulo}`.trim(),
      descripcion: ev.titulo,
    });
  }
  for (const a of p.agenda) {
    if ((a.hasta ?? a.fecha) < hoy) continue;
    eventos.push({
      uid: `agenda-${a.fecha}-${limpio(a.titulo)}`,
      fecha: a.fecha,
      titulo: `📌 ${a.titulo}`,
      descripcion: a.titulo,
      hora: a.hora,
      hasta: a.hasta,
      aviso: true,
    });
  }

  // Papeles y vencimientos (D-174): el día en que vence, de todo el día. Lo hecho no sale, y lo ya
  // vencido solo hasta un mes después (para que no se quede ahí para siempre).
  for (const v of p.vencimientos ?? []) {
    if (v.hechoEn !== null || v.fecha < sumarDias(hoy, -30)) continue;
    const de = v.personaId ? p.personas.find((x) => x.id === v.personaId)?.nombre : undefined;
    eventos.push({
      uid: `papel-${limpio(v.titulo)}-${v.fecha}`,
      fecha: v.fecha,
      titulo: `📄 ${v.titulo}${de ? ` · ${de}` : ""}`,
      descripcion: `Vence: ${v.titulo}${de ? ` de ${de}` : ""}`,
      aviso: true,
    });
  }

  for (const c of p.cumples) {
    const clave = limpio(c.nombre);
    // Tres cumpleaños seguidos, cada uno con su fecha: Google no siempre enseña los que se repiten
    // «cada año» cuando empiezan lejos, y así salen siempre.
    let dia = proximaFecha(c, hoy);
    for (let i = 0; i < 3; i++) {
      eventos.push({
        uid: `cumple-${clave}-${dia.slice(0, 4)}`,
        fecha: dia,
        titulo: `🎂 ${c.nombre}`,
        descripcion: `Cumpleaños de ${c.nombre}`,
        aviso: true,
      });
      dia = proximaFecha(c, sumarDias(dia, 1));
    }
    // Sin avisos de «pensar» ni «comprar» el regalo (D-143): en el calendario, solo el cumple.
  }

  // Lo recurrente de la casa: un evento por tarea, en el día que toca (hoy si va atrasada). Al
  // marcarla hecha en la app, la próxima vez que el móvil pida el calendario se mueve sola.
  const nombre = (id: string | null) => p.personas.find((x) => x.id === id)?.nombre ?? "Los dos";
  for (const t of p.casa) {
    if (persona && t.responsableId !== null && t.responsableId !== persona.id) continue;
    const toca = proximaVez({ ...t, id: "", aplazadaHasta: t.aplazadaHasta ?? null });
    const dia = toca < hoy ? hoy : toca;
    eventos.push({
      uid: `casa-${limpio(t.titulo)}`,
      fecha: dia,
      titulo: `${t.emoji} ${t.titulo}`,
      descripcion: `${t.titulo} (le toca a: ${nombre(t.responsableId)}). Se repite cada ${t.cadaDias} días desde la última vez que se hizo.`,
      aviso: true,
    });
  }
  // Qué llevar (D-136): el día de dejarlo preparado, a las 20:00 y con alarma.
  // Las del cole, solo si ese día hay cole (D-144).
  const ajustesCole = p.diasCole ?? [];
  const cosas = (p.mochila ?? []).map((c, i) => ({
    ...c,
    id: String(i),
    fecha: c.fecha ?? null,
    preparadas: [],
    soloConCole: c.soloConCole !== false,
  }));
  const nombreDe = (id: string) => p.personas.find((x) => x.id === id)?.nombre ?? "";
  for (const { dia, cosa, para } of preparacionesEntre(
    cosas,
    hoy,
    DIAS_MOCHILA,
    consultaCole(ajustesCole),
  )) {
    const quien = nombreDe(cosa.personaId);
    const cuando =
      para === dia
        ? "para hoy"
        : para === sumarDias(dia, 1)
          ? "para mañana"
          : `para el ${NOMBRE_DIA_LARGO[diaSemanaIso(para) - 1]}`;
    eventos.push({
      uid: `mochila-${dia}-${limpio(cosa.texto)}-${limpio(quien)}`,
      fecha: dia,
      titulo: `🎒 ${cosa.texto}${quien ? ` · ${quien}` : ""}`,
      descripcion: `Dejar preparado ${cosa.texto}${quien ? ` de ${quien}` : ""} ${cuando}.`,
      hora: HORA_MOCHILA,
      aviso: true,
    });
  }

  // Días sin cole entre semana (D-144), de todo el día y sin alarma: festivos, vacaciones, los del
  // centro. Solo los de los hogares con algo del cole (mochila o menú del cole) o días propios.
  const conCole =
    (p.mochila ?? []).length > 0 || (p.cole ?? []).length > 0 || ajustesCole.length > 0;
  if (conCole) {
    for (const t of tramosSinCole(ajustesCole, hoy, DIAS_SIN_COLE)) {
      const dias =
        (Date.parse(`${t.hasta}T00:00:00Z`) - Date.parse(`${t.desde}T00:00:00Z`)) / 864e5 + 1;
      if (dias < DIAS_PERIODO_LARGO) {
        eventos.push({
          uid: `sin-cole-${t.desde}`,
          fecha: t.desde,
          hasta: t.hasta === t.desde ? null : t.hasta,
          titulo: `🏫 Sin cole${motivoCorto(t.motivo)}`,
          descripcion: `No hay cole: ${t.motivo}.`,
        });
        continue;
      }
      // Un periodo largo (verano, Navidad, Semana Santa) son dos eventos, el inicio y el fin, y no
      // uno por día en la lista de Google (D-162).
      const nombre = /^vacaciones/i.test(t.motivo)
        ? `${t.motivo.charAt(0).toLowerCase()}${t.motivo.slice(1)}`
        : t.motivo;
      // El día en que vuelve el cole; si aún no se conoce el curso, tampoco el fin.
      let vuelta = sumarDias(t.hasta, 1);
      for (let i = 0; i < 10; i++) {
        if (diaSemanaIso(vuelta) < 6 && diaDeCole(vuelta, ajustesCole).hay) break;
        vuelta = sumarDias(vuelta, 1);
      }
      const finConocido = diaDeCole(vuelta, ajustesCole).origen !== "sin-datos";
      // Si ya empezó antes de hoy, el «inicio» no es hoy: no se pone.
      let antes = sumarDias(t.desde, -1);
      while (diaSemanaIso(antes) >= 6) antes = sumarDias(antes, -1);
      const empezoAntes = t.desde === hoy && !diaDeCole(antes, ajustesCole).hay;
      if (!empezoAntes) {
        eventos.push({
          uid: `sin-cole-inicio-${t.desde}`,
          fecha: t.desde,
          titulo: `🏫 Inicio ${nombre}`,
          descripcion: finConocido
            ? `Empieza ${nombre}: sin cole hasta el ${fechaLarga(t.hasta)}.`
            : `Empieza ${nombre}.`,
        });
      }
      if (finConocido) {
        eventos.push({
          uid: `sin-cole-fin-${t.hasta}`,
          fecha: t.hasta,
          titulo: `🏫 Fin ${nombre}`,
          descripcion: `Último día sin cole. El cole vuelve el ${fechaLarga(vuelta)}.`,
        });
      }
    }
  }

  // El estadio de al lado (D-159): partidos y conciertos, en su propio calendario (D-163). Si ese
  // día hay algo más apuntado, un aviso aparte en el de fechas, con alarma: ⚠️ Partido y Cumple de Leo.
  for (const ev of estadio) {
    if (ev.fecha < hoy) continue;
    const planes = planesDelDia(ev.fecha, p);
    if (planes.length > 0) {
      eventos.push({
        uid: `choque-${ev.id}`,
        fecha: ev.fecha,
        titulo: `⚠️ ${queEs(ev)} y ${planes.slice(0, 2).join(" + ")}`,
        descripcion: `Ese día hay ${minuscula(textoDelEvento(ev).replace(/^\S+ /, ""))} y también: ${planes.join(", ")}. Más tráfico, calles cortadas y el metro lleno unas dos horas antes y una después: sal con tiempo.`,
        aviso: true,
      });
    }
    eventos.push({
      uid: `estadio-${ev.id}`,
      fecha: ev.fecha,
      titulo: tituloCortoDelEvento(ev),
      descripcion: `${textoDelEvento(ev)}. Más tráfico, calles cortadas y el metro lleno unas dos horas antes y una después.`,
      hora: ev.hora,
    });
  }

  // Los planes del barrio (D-165), en su propio calendario: con su hora si se dice y, si no, de todo
  // el día. El lugar, el barrio, el precio y el enlace van en la descripción.
  for (const b of barrio) {
    if (b.serie) continue; // un ciclo de meses taparía el calendario
    if ((b.hasta ?? b.fecha) < hoy) continue;
    eventos.push({
      uid: `barrio-${b.id}-${b.fecha}`,
      fecha: b.fecha,
      hasta: b.hasta,
      titulo: `${b.emoji} ${b.titulo}`,
      descripcion: [
        b.titulo,
        [b.lugar, b.barrio ? `barrio de ${b.barrio}` : ""].filter(Boolean).join(", "),
        b.gratis ? "Gratis." : b.precio ? `Precio: ${b.precio}.` : "",
        b.familiar ? "Para ir en familia." : "",
        b.enlace ?? "",
      ]
        .filter(Boolean)
        .join("\n"),
      hora: b.hora,
    });
  }

  // El tiempo de los próximos días (D-154): qué llevar, de todo el día. Los días de cole, el
  // paraguas dice a qué hora llueve en la ida y la vuelta. Sin previsión, no sale nada.
  for (const t of tiempo) {
    if (t.fecha < hoy) continue;
    const deCole = conCole && diaDeCole(t.fecha, ajustesCole).hay;
    for (const l of lineasDelTiempo(t, deCole)) {
      eventos.push({
        uid: `tiempo-${t.fecha}-${l.clave}`,
        fecha: t.fecha,
        titulo: `${l.emoji} ${l.corto}`,
        descripcion: `${l.texto}. Previsión del tiempo en ${LUGAR_TIEMPO.nombre} (Open-Meteo). Puede cambiar: el aviso de las 7 la vuelve a mirar.`,
      });
    }
  }
  return eventos;
}
