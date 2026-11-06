/**
 * Un maullido hecho con el sonido del propio navegador (Web Audio): una voz que sube y baja de tono
 * a través de un filtro que abre y cierra la «a», como un «miauuu». No hay ningún archivo de audio.
 * Hay que llamarla desde un toque o clic (los navegadores no dejan sonar solos).
 */

/** Puntos (segundo, hercios) de la melodía del maullido: sube rápido y baja despacio. */
export const MELODIA_MAULLIDO: ReadonlyArray<readonly [number, number]> = [
  [0, 420],
  [0.18, 760],
  [0.45, 980],
  [0.9, 620],
  [1.25, 380],
];
/** Puntos (segundo, hercios) del filtro: «m» cerrada, «iau» abierta y vuelta a cerrar. */
export const FORMANTE_MAULLIDO: ReadonlyArray<readonly [number, number]> = [
  [0, 700],
  [0.2, 1900],
  [0.7, 1300],
  [1.25, 800],
];
export const DURACION_MAULLIDO = 1.3;

export function maullar(): void {
  try {
    const Contexto =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;
    const ctx = new Contexto();
    const t0 = ctx.currentTime;

    const voz = ctx.createOscillator();
    voz.type = "sawtooth";
    voz.frequency.setValueAtTime(MELODIA_MAULLIDO[0]![1], t0);
    for (const [t, hz] of MELODIA_MAULLIDO.slice(1)) {
      voz.frequency.linearRampToValueAtTime(hz, t0 + t);
    }

    // Un pequeño temblor (vibrato) para que no suene a pitido.
    const vibrato = ctx.createOscillator();
    const profundidad = ctx.createGain();
    vibrato.frequency.value = 6;
    profundidad.gain.value = 14;
    vibrato.connect(profundidad).connect(voz.frequency);

    const filtro = ctx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.Q.value = 4;
    filtro.frequency.setValueAtTime(FORMANTE_MAULLIDO[0]![1], t0);
    for (const [t, hz] of FORMANTE_MAULLIDO.slice(1)) {
      filtro.frequency.linearRampToValueAtTime(hz, t0 + t);
    }

    const volumen = ctx.createGain();
    volumen.gain.setValueAtTime(0.0001, t0);
    volumen.gain.exponentialRampToValueAtTime(0.9, t0 + 0.08);
    volumen.gain.setValueAtTime(0.9, t0 + 0.8);
    volumen.gain.exponentialRampToValueAtTime(0.0001, t0 + DURACION_MAULLIDO);

    voz.connect(filtro).connect(volumen).connect(ctx.destination);
    voz.start(t0);
    vibrato.start(t0);
    voz.stop(t0 + DURACION_MAULLIDO + 0.05);
    vibrato.stop(t0 + DURACION_MAULLIDO + 0.05);
    voz.onended = () => void ctx.close();
  } catch {
    // sin sonido en este dispositivo: el botón sigue animándose
  }
}
