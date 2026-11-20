"use client";

import { useSyncExternalStore } from "react";
import { type Momento, esMomento, momentoDeHora } from "@/dominio/momento";

function leer(): Momento | null {
  try {
    const forzado = new URLSearchParams(window.location.search).get("momento");
    if (esMomento(forzado)) return forzado;
  } catch {
    // sin ventana: se sigue
  }
  // Los datos de ejemplo (las pruebas) no dependen de la hora que sea.
  if (process.env.NEXT_PUBLIC_DATOS === "ejemplo") return null;
  return momentoDeHora(new Date().getHours());
}

function suscribir(avisar: () => void): () => void {
  const t = window.setInterval(avisar, 60_000);
  return () => window.clearInterval(t);
}

/** El momento del día en este móvil; null en el servidor y en los datos de ejemplo. */
export function useMomento(): Momento | null {
  return useSyncExternalStore(suscribir, leer, () => null);
}
