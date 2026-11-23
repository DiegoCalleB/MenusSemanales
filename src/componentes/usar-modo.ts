"use client";

import { type Modo, modoDe } from "@/dominio/modo";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

/** El modo de quien tiene el móvil (D-206) y si el laboratorio está encendido. */
export function useModo(): { modo: Modo; laboratorio: boolean; yoId: string | null } {
  const { estado } = useHogar();
  const [yoId] = useYo();
  return {
    modo: modoDe(estado.modos, estado.personas, yoId),
    laboratorio: estado.laboratorio,
    yoId,
  };
}
