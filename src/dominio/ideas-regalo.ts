import type { Relacion } from "./cumples";

/**
 * Ideas de regalo sin inventar productos concretos: categorías sensatas por edad y por gustos. Es
 * un punto de partida para que nadie empiece de cero; una IA podrá afinarlo más adelante con lo que
 * se sabe de cada persona (D-041), siempre a partir de estos datos.
 */

export const IDEAS_POR_EDAD: ReadonlyArray<{ hasta: number; ideas: readonly string[] }> = [
  {
    hasta: 2,
    ideas: [
      "Juguete de apilar o encajar",
      "Libro de cartón con texturas",
      "Instrumento musical sencillo",
      "Ropa cómoda",
      "Juguete para el baño",
    ],
  },
  {
    hasta: 5,
    ideas: [
      "Disfraz o juego de roles (médico, cocinita…)",
      "Puzle de su personaje favorito",
      "Libro de cuentos ilustrado",
      "Set de manualidades y pegatinas",
      "Juego de mesa cooperativo sencillo",
      "Bici, patinete o juego de exterior",
    ],
  },
  {
    hasta: 8,
    ideas: [
      "Juego de construcción (piezas encajables)",
      "Libro de aventuras o cómic infantil",
      "Kit de manualidades o de ciencia",
      "Juego de mesa para jugar en familia",
      "Material de dibujo y pintura",
      "Una experiencia: cine, parque de atracciones o taller",
    ],
  },
  {
    hasta: 12,
    ideas: [
      "Libro de una saga que le guste",
      "Kit de ciencia, robótica o experimentos",
      "Juego de mesa o de cartas",
      "Material creativo (acuarelas, cuadernos, pulseras)",
      "Equipamiento de su deporte o afición",
      "Una experiencia: taller, excursión o espectáculo",
    ],
  },
  {
    hasta: 17,
    ideas: [
      "Libro o cómic de su género favorito",
      "Auriculares o accesorio tecnológico",
      "Ropa o complementos de su estilo",
      "Entradas a un concierto o evento",
      "Material de su afición",
      "Tarjeta regalo de su tienda favorita",
    ],
  },
  {
    hasta: 200,
    ideas: [
      "Una experiencia (cena, escapada, taller)",
      "Un libro que encaje con sus gustos",
      "Algo para su afición",
      "Un detalle hecho a mano o personalizado",
      "Productos de cuidado personal o del hogar",
      "Una suscripción o entradas a algo que le guste",
    ],
  },
];

export const IDEAS_AMIGOS_DEL_COLE: readonly string[] = [
  "Un libro o cuento",
  "Set de pegatinas y manualidades pequeño",
  "Juego de cartas o de mesa pequeño",
  "Material de dibujo",
  "Un detalle de su personaje favorito",
];

/** Hasta 8 ideas: primero las de sus gustos, después las de su edad (o las de regalo pequeño para amigos del cole). */
export function ideasDeRegalo(args: {
  edad: number | null;
  relacion: Relacion;
  gustos?: readonly string[];
}): string[] {
  const deGustos = (args.gustos ?? [])
    .map((g) => g.trim())
    .filter((g) => g !== "")
    .slice(0, 3)
    .map((g) => `Algo de ${g}`);
  const base =
    args.relacion === "cole" && args.edad !== null && args.edad <= 12
      ? IDEAS_AMIGOS_DEL_COLE
      : (IDEAS_POR_EDAD.find((r) => (args.edad ?? 99) <= r.hasta)?.ideas ?? []);
  return [...new Set([...deGustos, ...base])].slice(0, 8);
}
