import {
  type DiaParaCompartir,
  type EventoCalendario,
  type SeccionCompra,
} from "@/dominio/compartir";
import { type FechaIso } from "@/dominio/fechas";
import { CATEGORIAS, NOMBRE_CATEGORIA, clasificarArticulo } from "@/dominio/habituales";
import { EMOJI_GRUPO, cantidadEnTexto } from "@/dominio/texto";
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

/** Días del plan con algo que contar (cena elegida o menú del cole), listos para compartir. */
export function planParaCompartir(e: EstadoHogar): { titulo: string; dias: DiaParaCompartir[] } {
  const dias: DiaParaCompartir[] = diasDelMenu(e)
    .filter((d) => !e.saltados.includes(d.fecha))
    .filter((d) => comidasDe(e, d.fecha).length > 0 || e.colegio[d.fecha] || e.eventos[d.fecha])
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
        evento: e.eventos[d.fecha] ?? null,
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
    manuales.set(c, [...(manuales.get(c) ?? []), m.nombre]);
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
  return eventos;
}
