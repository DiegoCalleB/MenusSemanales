/**
 * El maullido de la bienvenida: cuatro maullidos reales (efectos de sonido generados, recortados en
 * clips sueltos en `public/sonidos`). Cada toque suena uno distinto del anterior. Hay que llamarla
 * desde un toque o clic: los navegadores no dejan sonar solos.
 */
export const MAULLIDOS: readonly string[] = [
  "/sonidos/miau-1.mp3",
  "/sonidos/miau-2.mp3",
  "/sonidos/miau-3.mp3",
  "/sonidos/miau-4.mp3",
];

/** Elige un maullido distinto del último (con una sola opción, esa). Pura: se puede probar. */
export function elegirMaullido(
  opciones: readonly string[],
  ultimo: string | null,
  azar: () => number = Math.random,
): string {
  const posibles = opciones.length > 1 ? opciones.filter((o) => o !== ultimo) : [...opciones];
  return posibles[Math.min(posibles.length - 1, Math.floor(azar() * posibles.length))] as string;
}

let ultimo: string | null = null;

/** Hace sonar un maullido. Devuelve cuánto dura (ms) o `null` si el dispositivo no pudo reproducirlo. */
export async function maullar(): Promise<number | null> {
  try {
    const url = elegirMaullido(MAULLIDOS, ultimo);
    ultimo = url;
    const audio = new Audio(url);
    audio.volume = 1;
    await audio.play();
    return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : 1200;
  } catch {
    return null;
  }
}
