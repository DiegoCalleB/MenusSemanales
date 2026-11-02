"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";
import { enlaceWhatsApp } from "@/dominio/compartir";

const nadie = () => () => {};

/**
 * Las tres formas de sacar un texto de la app (D-082): **WhatsApp** (abre el chat con el mensaje
 * escrito; se elige a quién), **Compartir…** (el menú de compartir del móvil: Keep, correo, Telegram,
 * notas…, solo si el navegador lo ofrece) y **Copiar**. Sirve igual para el menú, la compra, las
 * fechas y lo que toca en casa, y se usa tanto en «Enviar» como en cada pantalla.
 */
export function BotonesCompartir({
  titulo,
  texto,
  deshabilitado = false,
  children,
}: {
  titulo: string;
  texto: string;
  deshabilitado?: boolean;
  children?: ReactNode;
}) {
  const [aviso, setAviso] = useState("");
  const puedeCompartir = useSyncExternalStore(
    nadie,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function compartir() {
    try {
      await navigator.share({ title: titulo, text: texto });
    } catch {
      // la persona canceló el cuadro de compartir: no es un error
    }
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso("Copiado. Pégalo donde quieras (WhatsApp, Keep, notas…).");
    } catch {
      setAviso("No se ha podido copiar. Abre «Enviar» (en «Más»), selecciónalo y cópialo a mano.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <a
          className={`boton ${deshabilitado ? "pointer-events-none opacity-50" : ""}`}
          href={deshabilitado ? undefined : enlaceWhatsApp(texto)}
          aria-disabled={deshabilitado || undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          Enviar por WhatsApp
        </a>
        {puedeCompartir && (
          <button
            type="button"
            className="boton-suave"
            disabled={deshabilitado}
            onClick={compartir}
          >
            Compartir…
          </button>
        )}
        <button type="button" className="boton-suave" disabled={deshabilitado} onClick={copiar}>
          Copiar
        </button>
        {children}
      </div>
      {aviso && (
        <p role="status" className="bg-ok-fondo text-ok-texto rounded-2xl p-3 text-base">
          {aviso}
        </p>
      )}
    </div>
  );
}
