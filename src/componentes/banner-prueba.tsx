"use client";

import { MODO_DATOS, useHogar } from "./proveedor-hogar";

/** Aviso mínimo de que no hay cuenta: los datos se quedan en este dispositivo. */
export function BannerPrueba() {
  const { restablecer } = useHogar();
  const diego = MODO_DATOS === "diego";
  return (
    <div className="bg-aviso-fondo text-aviso-texto border-aviso-texto/20 flex items-center justify-between gap-3 border-b px-4 py-1 text-base md:px-8">
      <p className="truncate">
        {diego ? (
          <>
            <strong>Modo Diego</strong> · solo en este dispositivo
          </>
        ) : (
          <>
            <strong>Modo prueba</strong> · datos de ejemplo
          </>
        )}
      </p>
      <button type="button" className="boton-suave shrink-0" onClick={restablecer}>
        {diego ? "Reiniciar" : "Restablecer ejemplo"}
      </button>
    </div>
  );
}
