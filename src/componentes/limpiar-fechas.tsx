"use client";

import { useEffect } from "react";
import { separarHoraDelTitulo } from "@/dominio/agenda";
import { useCuenta, useHogar } from "./proveedor-hogar";

/**
 * Arregla las citas que se apuntaron con la hora dentro del título. No pinta nada. Espera a que los
 * datos del hogar estén cargados, para no actuar sobre un estado a medias. Lo ya pasado no se borra
 * (D-152): se ve en Fechas → «Lo que ya pasó», con su puntuación.
 */
export function LimpiarFechas() {
  const { estado, despachar } = useHogar();
  const { fase } = useCuenta();
  // Citas que se apuntaron con la hora dentro del título («circo 18:00») y salen de todo el día.
  const hayHorasPorArreglar = estado.agenda.some(
    (a) => a.hora === null && separarHoraDelTitulo(a.titulo).hora !== null,
  );

  useEffect(() => {
    if (fase === "cargando") return;
    if (hayHorasPorArreglar) despachar({ tipo: "agenda/arreglarHoras" });
  }, [fase, hayHorasPorArreglar, despachar]);

  return null;
}
