"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { articulosPendientes } from "@/aplicacion/estado";
import { claveArticulo } from "@/dominio/habituales";
import { EntradaCompra } from "./entrada-compra";
import { useHogar } from "./proveedor-hogar";

/**
 * Botón flotante para apuntar algo a la lista de la compra desde cualquier pantalla, escribiendo o
 * dictando, sin tener que ir a «Compra»: lo que se acuerda en la cocina se apunta en dos toques.
 */
export function AnadirRapido() {
  const { estado } = useHogar();
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    panel.current?.querySelector("input")?.focus();
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  // En la propia lista de la compra ya está el campo para apuntar.
  if (ruta === "/compra") return null;

  const yaEnLista = new Set([
    ...articulosPendientes(estado).map((a) => claveArticulo(a.nombre)),
    ...estado.manuales.filter((m) => !m.comprado).map((m) => claveArticulo(m.nombre)),
  ]);

  return (
    <>
      {abierto && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Apuntar a la lista de la compra"
          className="bg-superficie border-borde fixed inset-x-3 bottom-24 z-40 flex flex-col gap-2 rounded-3xl border p-3 shadow-2xl md:inset-x-auto md:right-6 md:bottom-24 md:w-96"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-extrabold">🛒 Apuntar a la compra</p>
            <button type="button" className="boton-suave" onClick={() => setAbierto(false)}>
              Cerrar
            </button>
          </div>
          <EntradaCompra yaEnLista={yaEnLista} />
        </div>
      )}
      <button
        type="button"
        className="boton fixed right-4 bottom-20 z-30 size-14 rounded-full p-0 text-2xl shadow-lg md:right-6"
        aria-label="Apuntar a la lista de la compra"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <span aria-hidden="true">{abierto ? "✕" : "＋"}</span>
      </button>
    </>
  );
}
