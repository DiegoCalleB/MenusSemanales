"use client";

import { Buscador } from "../buscador";

/** El buscador de todo el hogar (D-177). */
export function BuscarVista() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Buscar <span aria-hidden="true">🔍</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Encuentra lo que se ha apuntado, esté donde esté: citas, papeles, pendientes, platos, la
          compra…
        </p>
      </header>
      <Buscador ambito="todo" autoEnfocar />
    </div>
  );
}
