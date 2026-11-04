"use client";

import { compatibilidadDe, explicacionDe } from "@/aplicacion/estado";
import { type Compatibilidad, textoCompatibilidad } from "@/dominio/compatibilidad";
import type { FechaIso } from "@/dominio/fechas";
import type { Opcion } from "@/dominio/menu";
import { useHogar } from "./proveedor-hogar";

/** La nota de 1 a 5 con cinco puntos y su palabra: el color no es lo único que la dice. */
function Puntuacion({ c }: { c: Compatibilidad }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold">
      <span className="sr-only">{textoCompatibilidad(c)}</span>
      <span aria-hidden="true" className="flex items-center gap-2">
        <span>🎒 Con el cole</span>
        <span className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={`size-3 rounded-full border-2 ${
                n <= c.puntos ? "border-marca bg-marca" : "border-borde bg-superficie"
              }`}
            />
          ))}
        </span>
        <span className="text-marca-fuerte">
          {c.puntos}/5 · {c.etiqueta}
        </span>
      </span>
    </p>
  );
}

/**
 * La compatibilidad con el cole (nota de 1 a 5) y por qué se recomienda esa cena para ese día: lo
 * segundo, plegado por defecto para no alargar la pantalla.
 */
export function Razones({ fecha, opcion }: { fecha: FechaIso; opcion: Opcion }) {
  const { estado } = useHogar();
  const { resumen, lineas } = explicacionDe(estado, fecha, opcion);
  const compat = compatibilidadDe(estado, fecha, opcion);
  return (
    <div className="flex flex-col">
      {compat && <Puntuacion c={compat} />}
      <details>
        <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center gap-1 text-base font-semibold">
          <span aria-hidden="true">💡</span> Por qué
        </summary>
        <div className="flex flex-col gap-1 pb-1 text-base">
          <p className="text-tinta">{resumen}</p>
          {compat && (
            <>
              <p className="text-tinta font-semibold">
                Compatibilidad con el cole: {compat.puntos} de 5
              </p>
              <ul className="text-tinta-suave ml-5 list-disc space-y-1">
                {compat.razones.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          )}
          {lineas.length > 0 && (
            <ul className="text-tinta-suave ml-5 list-disc space-y-1">
              {lineas.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
