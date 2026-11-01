"use client";

import { explicacionDe } from "@/aplicacion/estado";
import type { Opcion } from "@/dominio/menu";
import type { FechaIso } from "@/dominio/fechas";
import { useHogar } from "./proveedor-hogar";

/**
 * Por qué se recomienda esa cena para ese día: una frase siempre visible y, desplegable, todas las
 * razones (cole, equilibrio de la semana, tiempo, caducidad, gusto).
 */
export function Razones({ fecha, opcion }: { fecha: FechaIso; opcion: Opcion }) {
  const { estado } = useHogar();
  const { resumen, lineas } = explicacionDe(estado, fecha, opcion);
  return (
    <div className="mt-1 flex flex-col gap-1 text-base">
      <p className="text-tinta">
        <span aria-hidden="true">💡 </span>
        {resumen}
      </p>
      {lineas.length > 0 && (
        <details>
          <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center font-semibold">
            Ver por qué
          </summary>
          <ul className="text-tinta-suave ml-5 list-disc space-y-1 pb-2 text-base">
            {lineas.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
