"use client";

import Link from "next/link";
import { TEXTO_RIESGO, riesgoDeGuardado } from "@/aplicacion/guardado";
import { MODO_DATOS, useCuenta, useHogar } from "./proveedor-hogar";
import { ESTADO_NUBE, NUBE_DISPONIBLE } from "./usar-nube";

const ESTADO = {
  inactivo: "☁️",
  guardando: "☁️ Guardando…",
  "al-dia": "☁️ Al día",
  "sin-conexion": "☁️ Sin conexión",
  error: "☁️ Error",
} as const;

/** Aviso mínimo: dónde están los datos (solo este dispositivo o sincronizados) y acceso a la cuenta. */
export function BannerPrueba() {
  const { restablecer } = useHogar();
  const cuenta = useCuenta();
  const diego = MODO_DATOS === "diego";
  const conectado = cuenta.fase === "conectado";
  const riesgo = riesgoDeGuardado({
    nubeConfigurada: NUBE_DISPONIBLE,
    fase: cuenta.fase,
    sync: cuenta.sync,
    enLinea: cuenta.enLinea,
  });
  if (riesgo) {
    // Nada se guarda en la nube: franja de alerta permanente (D-102).
    return (
      <div
        role="alert"
        className="bg-peligro-fondo text-peligro-texto flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-base font-semibold md:px-8"
      >
        <p>⚠️ {TEXTO_RIESGO[riesgo]}</p>
        <Link href="/cuenta" className="boton shrink-0">
          Ir a Cuenta
        </Link>
      </div>
    );
  }
  return (
    <div className="bg-aviso-fondo text-aviso-texto border-aviso-texto/20 flex items-center justify-between gap-3 border-b px-4 py-1 text-base md:px-8">
      <p className="truncate">
        {conectado ? (
          <>
            <strong>{cuenta.hogar?.nombre}</strong> · sincronizado
            {!(cuenta.tablas.hogar && cuenta.tablas.menu) && (
              <>
                {" "}
                · <Link href="/cuenta">guardado en un documento, falta pasarlo a tablas</Link>
              </>
            )}
          </>
        ) : diego ? (
          <>
            <strong>Modo Diego</strong> · solo en este dispositivo
          </>
        ) : (
          <>
            <strong>Modo prueba</strong> · datos de ejemplo
          </>
        )}
      </p>
      {ESTADO_NUBE === "url-invalida" || ESTADO_NUBE === "clave-invalida" ? (
        <Link href="/cuenta" className="boton-suave shrink-0">
          ⚠️ Nube sin configurar bien
        </Link>
      ) : NUBE_DISPONIBLE ? (
        <Link href="/cuenta" className="boton-suave shrink-0">
          {conectado ? ESTADO[cuenta.sync] : "Entrar"}
        </Link>
      ) : (
        <button type="button" className="boton-suave shrink-0" onClick={restablecer}>
          {diego ? "Reiniciar" : "Restablecer ejemplo"}
        </button>
      )}
    </div>
  );
}
