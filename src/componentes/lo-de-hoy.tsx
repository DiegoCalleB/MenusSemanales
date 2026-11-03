"use client";

import { type FormEvent, useId, useState } from "react";
import {
  claveDeQue,
  cosasDeHoy,
  entradasDelDia,
  idDeEntrada,
  MAX_LARGO_QUE,
  TAREAS_BASICAS,
} from "@/dominio/registro";
import { useHogar } from "./proveedor-hogar";

const EMOJI = new Map(TAREAS_BASICAS.map((t) => [claveDeQue(t.que), t.emoji]));

/**
 * «Lo de hoy» (D-108): quién ha hecho qué hoy. Un toque en una persona la apunta; otro toque la
 * quita. Comida, cena y compra salen siempre; lo demás (gatos, lavavajillas…) se añade una vez y
 * después sale como sugerencia.
 */
export function LoDeHoy() {
  const { estado, despachar } = useHogar();
  const idForm = useId();
  const [extras, setExtras] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");

  const personas = estado.personas.filter((p) => p.activa);
  const { hoy, sugerencias } = cosasDeHoy(estado.registro, estado.hoy);
  const filas = [...hoy];
  for (const x of extras) if (!filas.some((f) => claveDeQue(f) === claveDeQue(x))) filas.push(x);
  const delDia = entradasDelDia(estado.registro, estado.hoy);
  const quienes = (cosa: string) =>
    new Set(delDia.filter((r) => claveDeQue(r.que) === claveDeQue(cosa)).map((r) => r.personaId));

  function anadir(valor: string) {
    const limpio = valor.replace(/\s+/g, " ").trim();
    if (limpio.length < 2) return;
    setExtras((x) => [...x, limpio]);
    setTexto("");
    setAbierto(false);
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    anadir(texto);
  }

  const total = delDia.length;
  return (
    <section aria-labelledby="lo-de-hoy" className="tarjeta flex flex-col gap-1 p-3 sm:p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="lo-de-hoy" className="text-lg font-extrabold">
          Lo de hoy
        </h2>
        <p className="text-tinta-suave text-sm">
          {total === 0
            ? "Toca a quien lo ha hecho"
            : `${total} ${total === 1 ? "cosa hecha" : "cosas hechas"}`}
        </p>
      </div>
      <ul className="flex flex-col">
        {filas.map((cosa) => {
          const hechos = quienes(cosa);
          return (
            <li
              key={claveDeQue(cosa)}
              className="border-borde flex min-h-11 items-center justify-between gap-2 border-b last:border-b-0"
            >
              <span className="min-w-0 truncate text-base font-semibold">
                <span aria-hidden="true">{EMOJI.get(claveDeQue(cosa)) ?? "✅"} </span>
                {cosa}
              </span>
              <span
                className="flex flex-wrap justify-end gap-1"
                role="group"
                aria-label={`Quién: ${cosa}`}
              >
                {personas.map((p) => {
                  const hecho = hechos.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={hecho}
                      aria-label={`${cosa}: ${p.nombre}`}
                      data-id={idDeEntrada(estado.hoy, cosa, p.id)}
                      onClick={() =>
                        despachar({
                          tipo: "registro/alternar",
                          fecha: estado.hoy,
                          que: cosa,
                          personaId: p.id,
                        })
                      }
                      className={`flex min-h-11 min-w-11 items-center justify-center rounded-full border px-2.5 text-sm font-bold transition-colors ${
                        hecho
                          ? "border-marca bg-marca text-sobre-marca"
                          : "border-borde bg-superficie text-tinta-suave"
                      }`}
                    >
                      {p.nombre}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>

      {abierto ? (
        <form onSubmit={enviar} className="flex flex-col gap-2 pt-1">
          <label htmlFor={`${idForm}-t`} className="sr-only">
            Otra cosa que se ha hecho hoy
          </label>
          <div className="flex gap-2">
            <input
              id={`${idForm}-t`}
              className="campo min-w-0 flex-1"
              value={texto}
              maxLength={MAX_LARGO_QUE}
              placeholder="Lavavajillas, gatos…"
              autoFocus
              onChange={(e) => setTexto(e.target.value)}
            />
            <button type="submit" className="boton" disabled={texto.trim().length < 2}>
              Añadir
            </button>
          </div>
          {sugerencias.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="boton-suave px-4"
                  onClick={() => anadir(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>
      ) : (
        <button type="button" className="boton-suave w-fit" onClick={() => setAbierto(true)}>
          ＋ Otra cosa
        </button>
      )}
    </section>
  );
}
