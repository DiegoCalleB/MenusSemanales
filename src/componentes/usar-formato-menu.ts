"use client";

import { useEffect, useState } from "react";
import { FORMATOS_MENU, type FormatoMenu } from "@/dominio/compartir";

const CLAVE = "menus-semanales:formato-menu";

/** El formato del mensaje del menú que prefiere esta persona (se recuerda en el móvil). */
export function useFormatoMenu(): [FormatoMenu, (f: FormatoMenu) => void] {
  const [formato, setFormato] = useState<FormatoMenu>("agenda");
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE);
      const valido = FORMATOS_MENU.find((f) => f.id === guardado);
      // Tras el primer pintado, para no desajustar el HTML del servidor con el del navegador.
      if (valido) void Promise.resolve().then(() => setFormato(valido.id));
    } catch {
      /* sin almacenamiento: se queda el de siempre */
    }
  }, []);
  return [
    formato,
    (f) => {
      setFormato(f);
      try {
        window.localStorage.setItem(CLAVE, f);
      } catch {
        /* sin almacenamiento */
      }
    },
  ];
}
