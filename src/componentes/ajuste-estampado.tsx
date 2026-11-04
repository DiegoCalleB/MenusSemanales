"use client";

import { ESTAMPADOS, useEstampado } from "./usar-estampado";

/** Elegir el detalle de animal print de este móvil (Cuenta). */
export function AjusteEstampado() {
  const [estampado, cambiar] = useEstampado();
  return (
    <section
      role="radiogroup"
      aria-labelledby="estampado-titulo"
      className="tarjeta flex flex-col gap-2"
    >
      <h2 id="estampado-titulo" className="text-lg font-extrabold">
        Un detalle de animal print <span aria-hidden="true">🐆🦓</span>
      </h2>
      <p className="text-tinta-suave text-base">Solo cambia este móvil.</p>
      <div className="flex flex-col gap-2">
        {ESTAMPADOS.map((e) => (
          <label
            key={e.id}
            className="border-borde bg-fondo has-checked:border-marca has-checked:bg-suave-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-base font-semibold"
          >
            <input
              type="radio"
              name="estampado"
              className="size-5 accent-[var(--marca)]"
              checked={estampado === e.id}
              onChange={() => cambiar(e.id)}
            />
            {e.nombre}
            {e.id !== "ninguno" && (
              <span aria-hidden="true" className="ml-auto flex gap-1">
                {(e.id === "los-dos" ? ["leopardo", "cebra"] : [e.id]).map((t) => (
                  <span key={t} className={`cinta cinta-${t} h-4 w-10 rounded-full`} />
                ))}
              </span>
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
