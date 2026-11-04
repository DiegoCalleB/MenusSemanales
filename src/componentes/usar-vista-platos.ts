"use client";

import { useEffect, useState } from "react";

export type VistaPlatos = "tarjetas" | "lista";

export const VISTAS_PLATOS: { id: VistaPlatos; nombre: string }[] = [
  { id: "tarjetas", nombre: "Tarjetas" },
  { id: "lista", nombre: "Lista" },
];

const CLAVE = "menus-semanales:vista-platos";

/** Cómo prefiere esta persona ver los platos (se recuerda en el móvil). */
export function useVistaPlatos(): [VistaPlatos, (v: VistaPlatos) => void] {
  const [vista, setVista] = useState<VistaPlatos>("tarjetas");
  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem(CLAVE);
      const valida = VISTAS_PLATOS.find((v) => v.id === guardada);
      // Tras el primer pintado, para no desajustar el HTML del servidor con el del navegador.
      if (valida) void Promise.resolve().then(() => setVista(valida.id));
    } catch {
      /* sin almacenamiento: se queda la de siempre */
    }
  }, []);
  return [
    vista,
    (v) => {
      setVista(v);
      try {
        window.localStorage.setItem(CLAVE, v);
      } catch {
        /* sin almacenamiento */
      }
    },
  ];
}
