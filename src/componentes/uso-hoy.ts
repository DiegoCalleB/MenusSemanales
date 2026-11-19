"use client";

import { useCallback, useEffect, useState } from "react";
import { type UsoHoy, sinUso, usarSeccion, usoDeAlmacen, verSeccion } from "@/dominio/uso";
import { useHogar } from "./proveedor-hogar";

const CLAVE = "menus-semanales:uso-hoy";

/** Lo que se sabe del uso de «Hoy» en este móvil (D-189). Nunca falla: sin almacenamiento, vacío. */
export function leerUso(): UsoHoy {
  try {
    return usoDeAlmacen(JSON.parse(window.localStorage.getItem(CLAVE) ?? "null"));
  } catch {
    return {};
  }
}

export function guardarUso(u: UsoHoy) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(u));
  } catch {
    // sin almacenamiento: no se cuenta y ya está
  }
}

export function olvidarUso() {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // nada que olvidar
  }
}

/**
 * Un apartado de «Hoy» que cuenta sus toques y sabe si lleva dos semanas sin usarse. `sin` se calcula
 * tras el primer pintado (el HTML del servidor no sabe nada de este móvil).
 */
export function useUsoSeccion(id: string, nombre: string) {
  const { estado } = useHogar();
  const hoy = estado.hoy;
  const [sin, setSin] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const u = verSeccion(leerUso(), id, nombre, hoy);
      guardarUso(u);
      setSin(sinUso(u, id, hoy));
    });
  }, [id, nombre, hoy]);

  const usar = useCallback(() => {
    guardarUso(usarSeccion(leerUso(), id, nombre, hoy));
  }, [id, nombre, hoy]);

  const mostrar = useCallback(() => {
    usar();
    setSin(false);
  }, [usar]);

  return { sin, usar, mostrar };
}
