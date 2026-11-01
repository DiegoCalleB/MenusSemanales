"use client";

import { explicacionDe } from "@/aplicacion/estado";
import type { FechaIso } from "@/dominio/fechas";
import type { Opcion } from "@/dominio/menu";
import { useHogar } from "./proveedor-hogar";

/** Por qué se recomienda esa cena para ese día: plegado por defecto para no alargar la pantalla. */
export function Razones({ fecha, opcion }: { fecha: FechaIso; opcion: Opcion }) {
  const { estado } = useHogar();
  const { resumen, lineas } = explicacionDe(estado, fecha, opcion);
  return (
    <details>
      <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center gap-1 text-base font-semibold">
        <span aria-hidden="true">💡</span> Por qué
      </summary>
      <div className="flex flex-col gap-1 pb-1 text-base">
        <p className="text-tinta">{resumen}</p>
        {lineas.length > 0 && (
          <ul className="text-tinta-suave ml-5 list-disc space-y-1">
            {lineas.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
