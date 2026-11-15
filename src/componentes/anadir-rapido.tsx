"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { articulosPendientes } from "@/aplicacion/estado";
import { claveArticulo } from "@/dominio/habituales";
import { ApuntarEventoRapido } from "./apuntar-evento-rapido";
import { EntradaCompra } from "./entrada-compra";
import { useHogar } from "./proveedor-hogar";

/**
 * Botón flotante para apuntar algo desde cualquier pantalla, en dos toques: a la lista de la compra
 * (escribiendo o dictando) o un evento (escribiéndolo o leyendo con IA la foto de un cartel, D-160).
 */
export function AnadirRapido() {
  const { estado } = useHogar();
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  // En «Compra» ya está el campo para la lista: allí se abre directamente en «Evento».
  const [que, setQue] = useState<"compra" | "evento">("compra");
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
          aria-label="Apuntar"
          className="bg-superficie border-borde fixed inset-x-3 bottom-24 z-40 flex max-h-[75vh] flex-col gap-2 overflow-y-auto rounded-3xl border p-3 shadow-2xl md:inset-x-auto md:right-6 md:bottom-24 md:w-96"
        >
          <div className="flex items-center justify-between gap-2">
            <div role="group" aria-label="Qué apuntar" className="flex gap-1">
              {(
                [
                  ["compra", "🛒 Compra"],
                  ["evento", "📌 Evento"],
                ] as const
              ).map(([id, texto]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={que === id}
                  className={que === id ? "boton" : "boton-suave"}
                  onClick={() => setQue(id)}
                >
                  {texto}
                </button>
              ))}
            </div>
            <button type="button" className="boton-suave" onClick={() => setAbierto(false)}>
              Cerrar
            </button>
          </div>
          {que === "compra" ? (
            <EntradaCompra yaEnLista={yaEnLista} />
          ) : (
            <ApuntarEventoRapido alTerminar={() => setAbierto(false)} />
          )}
        </div>
      )}
      <button
        type="button"
        className="boton fixed right-4 bottom-20 z-30 size-14 rounded-full p-0 text-2xl shadow-lg md:right-6"
        aria-label="Apuntar algo"
        aria-expanded={abierto}
        onClick={() => {
          if (!abierto) setQue(ruta === "/compra" ? "evento" : "compra");
          setAbierto((a) => !a);
        }}
      >
        <span aria-hidden="true">{abierto ? "✕" : "＋"}</span>
      </button>
    </>
  );
}
