/** El dictado del navegador (Web Speech): no en todos los móviles. Compartido por la compra y la caja única. */
export interface Reconocimiento {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type ConstructorReconocimiento = new () => Reconocimiento;

export const constructorVoz = (): ConstructorReconocimiento | null => {
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Para `useSyncExternalStore`: no hay nada a lo que suscribirse. */
export const nadie = () => () => {};

/** El mensaje cuando el micrófono falla, con el truco del teclado. */
export function problemaDeVoz(motivo: string): string {
  if (motivo === "no-speech" || motivo === "aborted") {
    return "No te he oído. Pulsa 🎤 y habla otra vez, o escribe lo que falta.";
  }
  return motivo === "not-allowed" || motivo === "service-not-allowed"
    ? "Este móvil no deja usar el micrófono desde la app. Toca el campo y usa el micrófono de tu teclado (🎤) para dictar."
    : "No se ha podido usar el micrófono del navegador. Usa el micrófono de tu teclado (🎤) para dictar.";
}
