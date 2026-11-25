"use client";

import { useState } from "react";
import { NO_FUI, clavePuntuacion } from "@/aplicacion/estado";
import { useHogar } from "./proveedor-hogar";

const fechaLarga = (f: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${f}T12:00:00Z`));

const DE_UNA_VEZ = 10;

/**
 * Lo que ya pasó (D-152): las citas terminadas, de la más reciente a la más antigua, cada una con
 * sus estrellas (de 1 a 5). Tocar la estrella que ya está puesta la quita.
 */
export function CitasPasadas() {
  const { estado, despachar } = useHogar();
  const [cuantas, setCuantas] = useState(DE_UNA_VEZ);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const pasadas = estado.agenda
    .filter((a) => (a.hasta ?? a.fecha) < estado.hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.titulo.localeCompare(b.titulo, "es"));

  return (
    <section aria-labelledby="ya-paso" className="tarjeta flex flex-col gap-3">
      <h2 id="ya-paso" className="text-xl font-extrabold">
        Lo que ya pasó
      </h2>
      {pasadas.length === 0 ? (
        <p className="text-tinta-suave text-base">
          Aquí saldrán las citas cuando pasen, para puntuarlas.
        </p>
      ) : (
        <ul aria-label="Citas pasadas" className="flex flex-col gap-2">
          {pasadas.slice(0, cuantas).map((a) => {
            const valor = estado.puntuacionesCitas[clavePuntuacion(a)] ?? 0;
            const noFui = valor === NO_FUI;
            const puntos = noFui ? 0 : valor;
            return (
              <li
                key={a.id}
                className={`bg-suave-1 flex flex-col gap-1 rounded-2xl p-3 ${noFui ? "opacity-60" : ""}`}
              >
                <p className="text-base font-semibold">
                  <span className={noFui ? "line-through" : ""}>{a.titulo}</span>
                  <span className="text-tinta-suave block text-sm font-normal">
                    {fechaLarga(a.fecha)}
                    {a.hasta ? ` – ${fechaLarga(a.hasta)}` : ""}
                  </span>
                </p>
                <div role="group" aria-label={`Puntuación de ${a.titulo}`} className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="min-h-11 min-w-11 rounded-xl text-2xl leading-none"
                      aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                      aria-pressed={n === puntos}
                      onClick={() =>
                        despachar({
                          tipo: "agenda/valorar",
                          id: a.id,
                          estrellas: n === puntos ? 0 : n,
                        })
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={n <= puntos ? "" : "opacity-30 grayscale"}
                      >
                        ⭐
                      </span>
                    </button>
                  ))}
                </div>
                {porBorrar === a.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">¿Borrar «{a.titulo}»?</span>
                    <button
                      type="button"
                      className="boton-suave"
                      onClick={() => {
                        despachar({ tipo: "agenda/borrar", id: a.id });
                        setPorBorrar(null);
                      }}
                    >
                      Sí, borrar
                    </button>
                    <button
                      type="button"
                      className="boton-suave"
                      onClick={() => setPorBorrar(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="boton-suave"
                      aria-pressed={noFui}
                      onClick={() =>
                        despachar({
                          tipo: "agenda/valorar",
                          id: a.id,
                          estrellas: noFui ? 0 : NO_FUI,
                        })
                      }
                    >
                      {noFui ? "↩️ Sí fui" : "🚫 No fui"}
                    </button>
                    <button
                      type="button"
                      className="boton-suave"
                      aria-label={`Borrar ${a.titulo}`}
                      onClick={() => setPorBorrar(a.id)}
                    >
                      🗑️ Borrar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pasadas.length > cuantas && (
        <button
          type="button"
          className="boton-suave self-start"
          onClick={() => setCuantas((n) => n + DE_UNA_VEZ)}
        >
          Ver más ({pasadas.length - cuantas})
        </button>
      )}
    </section>
  );
}
