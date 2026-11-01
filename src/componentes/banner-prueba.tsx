"use client";

import { MODO_DATOS, useHogar } from "./proveedor-hogar";

/** Avisa de que no hay cuenta: los datos se quedan en este dispositivo. */
export function BannerPrueba() {
  const { restablecer } = useHogar();
  const diego = MODO_DATOS === "diego";
  return (
    <div className="bg-aviso-fondo text-aviso-texto border-aviso-texto/20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2 text-base md:px-8">
      <p>
        {diego ? (
          <>
            <strong>Modo Diego.</strong> Vuestros datos, solo en este dispositivo.
          </>
        ) : (
          <>
            <strong>Modo prueba.</strong> Datos de ejemplo, solo en este dispositivo.
          </>
        )}
      </p>
      <button type="button" className="boton-suave" onClick={restablecer}>
        {diego ? "Empezar de nuevo" : "Restablecer ejemplo"}
      </button>
    </div>
  );
}
