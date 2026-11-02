"use client";

import { type FormEvent, useId, useState } from "react";
import { MAX_LARGO_NOTA_MENU } from "@/aplicacion/estado";
import type { FechaIso } from "@/dominio/fechas";
import { useHogar } from "./proveedor-hogar";

/**
 * Nota corta de la cena de un día («pollo a la plancha… o igual lomo, depende»). Se guarda al
 * salir del campo o al pulsar Intro, y viaja en el mensaje del menú que se comparte.
 */
export function NotaDelDia({ fecha }: { fecha: FechaIso }) {
  const { estado } = useHogar();
  // Con `key`, si la nota cambia desde fuera (otro móvil) el campo se reinicia con el valor nuevo.
  return <CampoNota key={estado.notasMenu[fecha] ?? ""} fecha={fecha} />;
}

function CampoNota({ fecha }: { fecha: FechaIso }) {
  const { estado, despachar } = useHogar();
  const id = useId();
  const guardada = estado.notasMenu[fecha] ?? "";
  const [texto, setTexto] = useState(guardada);

  function guardar(e?: FormEvent) {
    e?.preventDefault();
    if (texto.trim() !== guardada) despachar({ tipo: "menu/nota", fecha, texto });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-1">
      <label htmlFor={id} className="text-tinta-suave text-sm font-semibold">
        <span aria-hidden="true">📝 </span>Nota de la cena
      </label>
      <input
        id={id}
        className="campo"
        value={texto}
        maxLength={MAX_LARGO_NOTA_MENU}
        placeholder="o igual lomo, depende…"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => guardar()}
      />
    </form>
  );
}
