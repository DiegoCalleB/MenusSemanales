/**
 * Mensaje de bienvenida personal (regalo para Ana, 7 de noviembre de 2026; se adelanta al 6 para revisarlo). Es solo lógica de
 * cuándo sale y el texto; la pantalla y el sonido viven en `componentes`.
 */

/** Primer día en que puede salir. Antes de esa fecha no se enseña nunca. */
export const BIENVENIDA_ANA_DESDE = "2026-11-06";
/** Cuántas veces sale en un mismo móvil («las primeras veces»). */
export const BIENVENIDA_ANA_VECES = 3;

const sinTildes = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

/**
 * ¿Toca enseñar la bienvenida? Solo a Ana, desde el 7 de noviembre y hasta que ese móvil la haya
 * visto `BIENVENIDA_ANA_VECES` veces. Se reconoce por el nombre, no por el identificador, porque
 * en los datos reales los identificadores no se llaman «ana».
 */
export function tocaBienvenidaAna(entrada: {
  nombre: string | null | undefined;
  hoy: string;
  vistas: number;
}): boolean {
  return (
    !!entrada.nombre &&
    sinTildes(entrada.nombre) === "ana" &&
    entrada.hoy >= BIENVENIDA_ANA_DESDE &&
    entrada.vistas < BIENVENIDA_ANA_VECES
  );
}

export const TEXTO_BIENVENIDA_ANA = {
  titulo: "¡Felicidades, Ana!",
  subtitulo: "Esto es para ti 🎁",
  parrafos: [
    "Esta app es un regalo para que organizar la casa, a partir de ahora, sea mucho más sencillo, y para que no tengamos que pensar todo el día en «¿qué cenamos esta semana?», «¿y la que viene?», «¿cuándo cambiamos las sábanas y las toallas?».",
    "Todo está ¡Hecho! o planeado. ✅",
    "Está pensada a nuestra medida. Si quieres que cambie algo, pídemelo y lo cambio para ti.",
    "Olvídate de todo ahora: toca disfrutar de la vida. 🌷",
  ],
  despedida: "¡¡¡Te quiero muchísimo!!!",
  firma: "Tu gatito 🐱",
} as const;
