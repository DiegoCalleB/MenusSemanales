"use client";

import { useEffect } from "react";
import { IconoCerrar, IconoDeshacer } from "./iconos";
import { useHogar } from "./proveedor-hogar";

const DURACION_MS = 8000;

/**
 * Confirmación de lo que acaba de pasar, con «Deshacer». Se anuncia a los lectores de pantalla
 * (role="status") y se cierra sola, pero deja tiempo de sobra para pulsar.
 */
export function AvisoGlobal() {
  const { estado, despachar } = useHogar();
  const aviso = estado.aviso;

  useEffect(() => {
    if (!aviso) return;
    const temporizador = setTimeout(() => despachar({ tipo: "cerrarAviso" }), DURACION_MS);
    return () => clearTimeout(temporizador);
  }, [aviso, despachar]);

  const operacion = aviso?.operacionId
    ? estado.operaciones.find((o) => o.id === aviso.operacionId)
    : undefined;
  const puedeDeshacer = operacion !== undefined && !operacion.deshecha;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 md:inset-x-auto md:right-6 md:bottom-6 md:w-96"
    >
      {aviso && (
        <div
          className={`pointer-events-auto flex items-center gap-2 rounded-2xl border p-3 shadow-lg ${
            aviso.tipo === "error"
              ? "border-peligro-texto/30 bg-peligro-fondo text-peligro-texto"
              : "border-borde bg-superficie text-tinta"
          }`}
        >
          <p className="min-w-0 flex-1 text-base">{aviso.texto}</p>
          {puedeDeshacer && (
            <button
              type="button"
              className="boton-suave shrink-0"
              onClick={() =>
                operacion && despachar({ tipo: "deshacer", operacionId: operacion.id })
              }
            >
              <IconoDeshacer width={20} height={20} />
              Deshacer
            </button>
          )}
          <button
            type="button"
            className="boton-suave shrink-0 !border-transparent !bg-transparent"
            aria-label="Cerrar aviso"
            onClick={() => despachar({ tipo: "cerrarAviso" })}
          >
            <IconoCerrar width={20} height={20} />
          </button>
        </div>
      )}
    </div>
  );
}
