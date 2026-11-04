"use client";

import { type FormEvent, useRef, useState, useSyncExternalStore } from "react";
import { HABITUALES, claveArticulo, sugerencias } from "@/dominio/habituales";
import { IconoMas } from "./iconos";
import { useHogar } from "./proveedor-hogar";

interface Reconocimiento {
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

const constructorVoz = (): ConstructorReconocimiento | null => {
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const nadie = () => () => {};

/**
 * Apuntar a la lista de la forma más rápida posible: escribir o dictar varias cosas de una vez
 * («leche, huevos y pan»), tocar una sugerencia mientras se escribe o tocar «lo de siempre».
 */
export function EntradaCompra({ yaEnLista }: { yaEnLista: ReadonlySet<string> }) {
  const { despachar } = useHogar();
  const [texto, setTexto] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [problema, setProblema] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const hayVoz = useSyncExternalStore(
    nadie,
    () => constructorVoz() !== null,
    () => false,
  );

  const sugeridas = sugerencias(texto, yaEnLista);
  const siempre = HABITUALES.filter((h) => !yaEnLista.has(claveArticulo(h)));

  function apuntar(valor: string) {
    despachar({ tipo: "manual/anadir", nombre: valor });
    setTexto("");
    setProblema("");
    campo.current?.focus();
  }
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    apuntar(texto);
  }

  function dictar() {
    const Voz = constructorVoz();
    if (!Voz) return;
    setProblema("");
    const r = new Voz();
    r.lang = "es-ES";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const dicho = e.results[0]?.[0]?.transcript ?? "";
      if (dicho.trim() !== "") apuntar(dicho);
    };
    r.onerror = (e) => {
      const motivo = e.error ?? "";
      if (motivo === "no-speech" || motivo === "aborted") {
        setProblema("No te he oído. Pulsa 🎤 y habla otra vez, o escribe lo que falta.");
        return;
      }
      // Sin permiso o sin servicio (en el iPhone pasa a menudo con la app puesta en la pantalla de
      // inicio): el dictado del teclado sí funciona, así que dejamos el cursor listo para usarlo.
      setProblema(
        motivo === "not-allowed" || motivo === "service-not-allowed"
          ? "Este móvil no deja usar el micrófono desde la app. Toca el campo y usa el micrófono de tu teclado (🎤) para dictar."
          : "No se ha podido usar el micrófono del navegador. Usa el micrófono de tu teclado (🎤) para dictar.",
      );
      campo.current?.focus();
    };
    r.onend = () => setEscuchando(false);
    setEscuchando(true);
    try {
      r.start();
    } catch {
      setEscuchando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={enviar} className="flex gap-2" aria-label="Añadir un artículo">
        <label htmlFor="nuevo-articulo" className="sr-only">
          Añadir algo a la lista
        </label>
        <input
          id="nuevo-articulo"
          ref={campo}
          className="campo flex-1"
          placeholder="Leche, pan y huevos…"
          value={texto}
          maxLength={400}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setTexto(e.target.value)}
        />
        {hayVoz && (
          <button
            type="button"
            className={escuchando ? "boton" : "boton-suave"}
            aria-pressed={escuchando}
            aria-label="Dictar por voz"
            onClick={dictar}
          >
            <span aria-hidden="true">🎤</span>
          </button>
        )}
        <button type="submit" className="boton" disabled={texto.trim() === ""}>
          <IconoMas width={20} height={20} />
          Añadir
        </button>
      </form>

      {problema && (
        <p role="status" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-3 text-base">
          {problema}
        </p>
      )}

      {sugeridas.length > 0 && (
        <ul aria-label="Sugerencias" className="flex flex-wrap gap-2">
          {sugeridas.map((s) => (
            <li key={s}>
              <button type="button" className="boton-suave" onClick={() => apuntar(s)}>
                + {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {siempre.length > 0 && (
        <details>
          <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
            ⚡ Lo de siempre ({siempre.length})
          </summary>
          <ul
            aria-label="Lo de siempre"
            className="flex max-h-56 flex-wrap gap-2 overflow-auto pb-2"
          >
            {siempre.map((h) => (
              <li key={h}>
                <button type="button" className="boton-suave" onClick={() => apuntar(h)}>
                  + {h}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
