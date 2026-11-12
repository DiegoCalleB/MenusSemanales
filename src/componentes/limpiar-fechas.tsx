"use client";

import { useEffect } from "react";
import { separarHoraDelTitulo } from "@/dominio/agenda";
import { useCuenta, useHogar } from "./proveedor-hogar";

/**
 * Mantiene al día «Próximas fechas» (D-123): cuando un apunte ya ha pasado, se quita solo. No pinta
 * nada. Espera a que los datos del hogar estén cargados, para no actuar sobre un estado a medias.
 */
export function LimpiarFechas() {
  const { estado, despachar } = useHogar();
  const { fase } = useCuenta();
  const hayPasadas = estado.agenda.some((a) => (a.hasta ?? a.fecha) < estado.hoy);
  // Citas que se apuntaron con la hora dentro del título («circo 18:00») y salen de todo el día.
  const hayHorasPorArreglar = estado.agenda.some(
    (a) => a.hora === null && separarHoraDelTitulo(a.titulo).hora !== null,
  );

  useEffect(() => {
    if (fase === "cargando") return;
    if (hayPasadas) despachar({ tipo: "agenda/limpiar" });
    if (hayHorasPorArreglar) despachar({ tipo: "agenda/arreglarHoras" });
  }, [fase, hayPasadas, hayHorasPorArreglar, estado.hoy, despachar]);

  return null;
}
