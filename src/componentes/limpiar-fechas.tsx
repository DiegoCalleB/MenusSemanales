"use client";

import { useEffect } from "react";
import { useCuenta, useHogar } from "./proveedor-hogar";

/**
 * Mantiene al día «Próximas fechas» (D-123): cuando un apunte ya ha pasado, se quita solo. No pinta
 * nada. Espera a que los datos del hogar estén cargados, para no actuar sobre un estado a medias.
 */
export function LimpiarFechas() {
  const { estado, despachar } = useHogar();
  const { fase } = useCuenta();
  const hayPasadas = estado.agenda.some((a) => (a.hasta ?? a.fecha) < estado.hoy);

  useEffect(() => {
    if (fase === "cargando" || !hayPasadas) return;
    despachar({ tipo: "agenda/limpiar" });
  }, [fase, hayPasadas, estado.hoy, despachar]);

  return null;
}
