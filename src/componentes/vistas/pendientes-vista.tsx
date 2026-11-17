"use client";

import { Pendientes } from "../pendientes";

/** Pendientes sin fecha (D-175): lo que hay que hacer «algún día». */
export function PendientesVista() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Pendientes <span aria-hidden="true">📝</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Lo que hay que hacer «algún día» y no tiene fecha: llamar al fontanero, arreglar la
          persiana… Apúntalo aquí y no se pierde: el domingo te recuerdo lo que sigue esperando.
        </p>
      </header>
      <Pendientes />
    </div>
  );
}
