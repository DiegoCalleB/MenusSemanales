"use client";

import { useEffect, useState } from "react";
import { resumenDeUso } from "@/dominio/uso";
import { leerUso, olvidarUso } from "./uso-hoy";
import { useHogar } from "./proveedor-hogar";

/**
 * Qué apartados de «Hoy» se usan en este móvil (D-189), para recortar con datos. Solo se cuenta en
 * este móvil cuántas veces se toca cada apartado: no se guarda qué se tocó ni sale de aquí.
 */
export function PanelUso() {
  const { estado } = useHogar();
  const [version, setVersion] = useState(0);
  const [filas, setFilas] = useState<ReturnType<typeof resumenDeUso>>([]);
  // Tras el primer pintado (el servidor no sabe nada de este móvil) y tras olvidar.
  useEffect(() => {
    void Promise.resolve().then(() => setFilas(resumenDeUso(leerUso(), estado.hoy)));
  }, [estado.hoy, version]);

  return (
    <details className="tarjeta">
      <summary className="flex min-h-11 cursor-pointer items-center text-lg font-extrabold">
        Qué usáis de «Hoy»
      </summary>
      <div className="flex flex-col gap-2 pt-1">
        <p className="text-tinta-suave text-base">
          Toques en cada apartado en las dos últimas semanas, solo en este móvil. Los que llevan dos
          semanas sin tocarse (y no tienen nada pendiente) se pliegan solos en «Hoy».
        </p>
        {filas.length === 0 ? (
          <p className="text-tinta-suave text-base">Aún no hay datos: abre «Hoy» unos días.</p>
        ) : (
          <ul aria-label="Uso de los apartados" className="flex flex-col gap-1">
            {filas.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-base">
                <span>{f.nombre}</span>
                <span className="text-tinta-suave text-sm tabular-nums">
                  {f.usos} {f.usos === 1 ? "toque" : "toques"}
                  {f.sinUso ? " · plegado" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="boton-suave w-fit"
          onClick={() => {
            olvidarUso();
            setVersion((v) => v + 1);
          }}
        >
          Empezar a contar de nuevo
        </button>
      </div>
    </details>
  );
}
