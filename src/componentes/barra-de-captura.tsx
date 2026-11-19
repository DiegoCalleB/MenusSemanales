"use client";

import { type FormEvent, useState } from "react";

/** El aviso con el que la barra de la portada abre la caja de «Apuntar» (la de ＋), con su texto. */
export const EVENTO_APUNTAR = "hecho-apuntar";

/**
 * Una barra para soltar lo que se te ocurra desde «Hoy» (D-188): se escribe («pañales y leche, el
 * jueves pediatra de Alba, llamar al fontanero») y se abre la misma caja de ＋, con la IA repartiendo
 * lo escrito entre compra, citas, pendientes y papeles. Nada se apunta sin que se vea antes.
 */
export function BarraDeCaptura() {
  const [texto, setTexto] = useState("");

  function enviar(e: FormEvent) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent(EVENTO_APUNTAR, { detail: { texto: texto.trim() } }));
    setTexto("");
  }

  return (
    <form onSubmit={enviar} role="search" aria-label="Apuntar rápido" className="flex gap-2">
      <input
        className="campo min-w-0 flex-1"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={500}
        autoComplete="off"
        enterKeyHint="send"
        aria-label="Escribe lo que quieras apuntar"
        placeholder="Apunta lo que sea: compra, cita, pendiente…"
      />
      <button type="submit" className="boton shrink-0">
        <span aria-hidden="true">✨ </span>Anotar
      </button>
    </form>
  );
}
