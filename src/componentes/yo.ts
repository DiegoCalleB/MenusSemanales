"use client";

import { useCallback, useSyncExternalStore } from "react";

const CLAVE = "menus-semanales:yo";
const EVENTO = "menus-semanales:yo-cambia";

function suscribir(aviso: () => void) {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO, aviso);
  };
}

function leer(): string | null {
  try {
    return window.localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

/**
 * Quién usa este dispositivo («soy Ana»). Es una preferencia del propio móvil: no se sincroniza,
 * porque cada persona usa el suyo. Sirve para saludar por el nombre, abrir sus tareas y no enseñar
 * lo que es una sorpresa para otra persona (como el regalo).
 */
export function useYo(): [string | null, (id: string | null) => void] {
  const yo = useSyncExternalStore(suscribir, leer, () => null);
  const cambiar = useCallback((id: string | null) => {
    try {
      if (id === null) window.localStorage.removeItem(CLAVE);
      else window.localStorage.setItem(CLAVE, id);
    } catch {
      // sin almacenamiento: no se recuerda
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);
  return [yo, cambiar];
}
