"use client";

import { Medicacion } from "../medicacion";

/** Medicación (D-166): su propia pantalla, en Casa → Medicación, para encontrarla a la primera. */
export function MedicacionVista() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Medicación <span aria-hidden="true">💊</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Apunta lo que toma cada uno y a qué hora. El móvil de esa persona recibe el aviso, y en
          «Hoy» se marca como tomado.
        </p>
      </header>
      <Medicacion />
    </div>
  );
}
