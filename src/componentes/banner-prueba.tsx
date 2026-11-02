"use client";

import Link from "next/link";
import { MODO_DATOS, useCuenta, useHogar } from "./proveedor-hogar";
import { NUBE_DISPONIBLE } from "./usar-nube";

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
  return (
    <div className="bg-aviso-fondo text-aviso-texto border-aviso-texto/20 flex items-center justify-between gap-3 border-b px-4 py-1 text-base md:px-8">
      <p className="truncate">
        {conectado ? (
          <>
            <strong>{cuenta.hogar?.nombre}</strong> · sincronizado
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
      {NUBE_DISPONIBLE ? (
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
