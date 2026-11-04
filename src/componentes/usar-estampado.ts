"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Estampado = "los-dos" | "leopardo" | "cebra" | "ninguno";

export const ESTAMPADOS: { id: Estampado; nombre: string }[] = [
  { id: "los-dos", nombre: "Leopardo y cebra" },
  { id: "leopardo", nombre: "Leopardo" },
  { id: "cebra", nombre: "Cebra" },
  { id: "ninguno", nombre: "Sin estampado" },
];

const CLAVE = "menus-semanales:estampado";
const EVENTO = "menus-semanales:estampado-cambia";
const POR_DEFECTO: Estampado = "los-dos";

function suscribir(aviso: () => void) {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO, aviso);
  };
}

function leer(): Estampado {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return ESTAMPADOS.find((e) => e.id === v)?.id ?? POR_DEFECTO;
  } catch {
    return POR_DEFECTO;
  }
}

/**
 * El detalle de animal print (leopardo y cebra) que se enseña en la app. Es una preferencia del
 * propio móvil: no se sincroniza, igual que «quién soy» (D-124).
 */
export function useEstampado(): [Estampado, (e: Estampado) => void] {
  const estampado = useSyncExternalStore(suscribir, leer, () => POR_DEFECTO);
  const cambiar = useCallback((e: Estampado) => {
    try {
      window.localStorage.setItem(CLAVE, e);
    } catch {
      // sin almacenamiento: no se recuerda
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);
  return [estampado, cambiar];
}
