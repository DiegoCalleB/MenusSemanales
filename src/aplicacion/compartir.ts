import {
  type DiaParaCompartir,
  type EventoCalendario,
  type SeccionCompra,
} from "@/dominio/compartir";
import { type FechaIso } from "@/dominio/fechas";
import { cuandoToca, diasParaCasa, ordenadasPorFecha } from "@/dominio/casa";
import { cuentaAtras } from "@/dominio/cuenta-atras";
import type { FechaParaCompartir, TareaParaCompartir } from "@/dominio/compartir";
import { proximaFecha } from "@/dominio/cumples";
import { CATEGORIAS, NOMBRE_CATEGORIA, clasificarArticulo } from "@/dominio/habituales";
import { EMOJI_GRUPO, NOMBRE_GRUPO_ES, cantidadEnTexto, formatearLista } from "@/dominio/texto";
import type { MenuCole } from "@/dominio/menu";
import { SECCIONES } from "@/dominio/tipos";
import {
  type EstadoHogar,
  articulosPendientes,
  comidasDe,
  diasDelMenu,
  nombreDia,
  nombreMes,
} from "./estado";

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const SECCION: Record<(typeof SECCIONES)[number], { nombre: string; emoji: string }> = {
  fruta_verdura: { nombre: "Fruta y verdura", emoji: "🥦" },
  panaderia: { nombre: "Panadería", emoji: "🍞" },
  carne: { nombre: "Carne", emoji: "🥩" },
  pescado: { nombre: "Pescado", emoji: "🐟" },
  lacteos: { nombre: "Lácteos", emoji: "🥛" },
  huevos: { nombre: "Huevos", emoji: "🥚" },
  conservas: { nombre: "Conservas", emoji: "🥫" },
  despensa: { nombre: "Despensa", emoji: "🍝" },
  congelados: { nombre: "Congelados", emoji: "🧊" },
  bebidas: { nombre: "Bebidas", emoji: "🥤" },
  limpieza: { nombre: "Limpieza y hogar", emoji: "🧴" },
  otros: { nombre: "Otros", emoji: "🛒" },
};

/**
 * Lo del cole de un día, para el mensaje del menú: lo que comieron (con las palabras del cole) y
 * por qué se propone esa cena. Sale solo de datos: si no se sabe, no se dice nada.
 */
export function coleParaCompartir(
  cole: MenuCole,
  fecha: string,
  hoy: string,
  cenas: readonly string[],
): { coleTexto?: string; porque?: string } {
  const textos = [cole.textoPrimero, cole.textoSegundo]
    .map((t) => (t ?? "").trim())
    .filter((t) => t !== "");
  const grupos = [cole.primero, cole.segundo]
    .filter((g): g is NonNullable<typeof g> => !!g && g !== "otro")
    .map((g) => NOMBRE_GRUPO_ES[g] ?? g);
  const unicos = [...new Set(grupos)];
  const verbo = fecha < hoy ? "comieron" : fecha === hoy ? "comen" : "comerán";
  return {
    ...(textos.length > 0 ? { coleTexto: textos.join(" + ") } : {}),
    ...(unicos.length > 0 && cenas.length > 0
      ? {
          porque: `Como en el cole ${verbo} ${formatearLista(unicos)}, propongo de cena ${cenas.join(" + ")}`,
        }
      : {}),
  };
}

/** Días del plan con algo que contar (cena elegida o menú del cole), listos para compartir. */
export function planParaCompartir(e: EstadoHogar): { titulo: string; dias: DiaParaCompartir[] } {
  const dias: DiaParaCompartir[] = diasDelMenu(e)
    .filter((d) => !e.saltados.includes(d.fecha))
    .filter(
      (d) =>
        comidasDe(e, d.fecha).length > 0 ||
        e.colegio[d.fecha] ||
        e.eventos[d.fecha] ||
        e.almuerzos.some((a) => a.fecha === d.fecha),
    )
    .map((d) => {
      const cole = e.colegio[d.fecha];
      return {
        fecha: d.fecha,
        etiqueta: `${mayuscula(nombreDia(d.fecha))} ${Number(d.fecha.slice(8))}`,
        cole: [cole?.primero, cole?.segundo]
          .filter((g): g is NonNullable<typeof g> => !!g)
          .map((g) => EMOJI_GRUPO[g])
          .join(" "),
        platos: comidasDe(e, d.fecha).map((c) => c.plato.nombre),
        comida: e.almuerzos.filter((a) => a.fecha === d.fecha).map((a) => a.texto),
        evento: e.eventos[d.fecha] ?? null,
        ...(e.notasMenu[d.fecha] ? { nota: e.notasMenu[d.fecha] } : {}),
        ...(cole
          ? coleParaCompartir(
              cole,
              d.fecha,
              e.hoy,
              comidasDe(e, d.fecha).map((c) => c.plato.nombre),
            )
          : {}),
      };
    });
  const primero = dias[0]?.fecha;
  const ultimo = dias.at(-1)?.fecha;
  const titulo =
    primero && ultimo
      ? primero === ultimo
        ? `Menú del ${Number(primero.slice(8))} de ${nombreMes(primero)}`
        : `Menú del ${Number(primero.slice(8))} al ${Number(ultimo.slice(8))} de ${nombreMes(ultimo)}`
      : "Menú de la semana";
  return { titulo, dias };
}

/** Lo que falta por comprar, agrupado por sección del súper y listo para compartir. */
export function seccionesDeCompra(e: EstadoHogar): {
  secciones: SeccionCompra[];
  manuales: string[];
} {
  const porSeccion = new Map<string, string[]>();
  for (const a of articulosPendientes(e)) {
    const lista = porSeccion.get(a.seccion) ?? [];
    lista.push(`${a.nombre} · ${cantidadEnTexto(a.cantidad, a.unidad)}`);
    porSeccion.set(a.seccion, lista);
  }
  const secciones = SECCIONES.filter((s) => porSeccion.has(s)).map((s) => ({
    ...SECCION[s],
    lineas: porSeccion.get(s) ?? [],
  }));
  // Lo apuntado a mano se agrupa por sección igual que lo automático.
  const manuales = new Map<string, string[]>();
  for (const m of e.manuales.filter((x) => !x.comprado)) {
    const c = m.categoria ?? clasificarArticulo(m.nombre);
    manuales.set(c, [
      ...(manuales.get(c) ?? []),
      m.cantidad ? `${m.nombre} · ${m.cantidad}` : m.nombre,
    ]);
  }
  for (const c of CATEGORIAS) {
    const lineas = manuales.get(c);
    if (!lineas) continue;
    const existente = secciones.find((s) => s.nombre === NOMBRE_CATEGORIA[c].nombre);
    if (existente) (existente.lineas as string[]).push(...lineas);
    else secciones.push({ ...NOMBRE_CATEGORIA[c], lineas });
  }
  return { secciones, manuales: [] };
}

/** Eventos de calendario: una cena por día y las fechas señaladas (cumpleaños…). */
export function eventosDeCalendario(e: EstadoHogar): EventoCalendario[] {
  const eventos: EventoCalendario[] = [];
  const fechas = new Set<FechaIso>([...e.comidas.map((c) => c.fecha), ...Object.keys(e.eventos)]);
  for (const fecha of [...fechas].sort()) {
    const comidas = comidasDe(e, fecha);
    if (comidas.length > 0) {
      const cole = e.colegio[fecha];
      eventos.push({
        fecha,
        titulo: `🍽️ Cena: ${comidas.map((c) => c.plato.nombre).join(" + ")}`,
        descripcion: [
          cole?.textoPrimero
            ? `🎒 Cole: ${cole.textoPrimero}${cole.textoSegundo ? ` / ${cole.textoSegundo}` : ""}`
            : "",
          `Platos: ${comidas.map((c) => c.plato.nombre).join(", ")}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }
    const ev = e.eventos[fecha];
    if (ev) eventos.push({ fecha, titulo: `${ev.emoji} ${ev.titulo}`, descripcion: ev.titulo });
  }
  // Cumpleaños: solo el día, con su tarta (D-143; sin avisos de regalo). Se repiten cada año, así el
  // móvil avisa solo sin tener que abrir la app.
  for (const c of e.cumples) {
    const dia = proximaFecha(c, e.hoy);
    eventos.push({
      fecha: dia,
      titulo: `🎂 Cumple de ${c.nombre}`,
      descripcion: `Cumpleaños de ${c.nombre}`,
      anual: true,
      aviso: true,
    });
  }
  // La comida del mediodía de los días en que se piensa (D-079).
  for (const a of e.almuerzos) {
    eventos.push({
      fecha: a.fecha,
      titulo: `☀️ Comida: ${a.texto}`,
      descripcion: `Comida: ${a.texto}`,
    });
  }
  // Lo apuntado a mano (D-075): con aviso, para que el móvil lo recuerde sin abrir la app.
  for (const a of e.agenda) {
    eventos.push({
      fecha: a.fecha,
      titulo: `📌 ${a.titulo}`,
      descripcion: a.titulo,
      hora: a.hora,
      hasta: a.hasta,
      aviso: true,
    });
  }
  return eventos;
}

const etiquetaFecha = (f: FechaIso) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${f}T12:00:00Z`))
    .replace(/\./g, "");

/** Lo próximo (cumples, apuntes y fechas señaladas, 45 días) listo para compartir. */
export function fechasParaCompartir(e: EstadoHogar): FechaParaCompartir[] {
  return cuentaAtras(e.cumples, e.eventos, e.hoy, {
    maxDias: 45,
    max: 25,
    externos: e.agenda.map((a) => ({
      fecha: a.fecha,
      titulo: a.titulo,
      hora: a.hora,
      hasta: a.hasta,
    })),
  }).map((c) => ({
    etiqueta: etiquetaFecha(c.fecha),
    emoji: c.emoji,
    titulo: c.titulo,
    hora: c.hora,
    cuando: c.dias === 0 ? "hoy" : c.dias === 1 ? "mañana" : `en ${c.dias} días`,
  }));
}

/** Lo que toca en casa hoy y esta semana, con quién lo lleva. */
export function casaParaCompartir(e: EstadoHogar): TareaParaCompartir[] {
  const nombre = (id: string | null) => e.personas.find((p) => p.id === id)?.nombre ?? "Los dos";
  return ordenadasPorFecha(e.casa, e.hoy)
    .filter((t) => diasParaCasa(t, e.hoy) <= 7)
    .map((t) => ({
      emoji: t.emoji,
      titulo: t.titulo,
      quien: nombre(t.responsableId),
      cuando: cuandoToca(diasParaCasa(t, e.hoy)).replace(/^toca /, ""),
    }));
}
