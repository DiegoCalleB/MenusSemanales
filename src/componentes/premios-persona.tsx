"use client";

import { type FormEvent, useState } from "react";
import {
  COSTE_MAXIMO,
  COSTE_MINIMO,
  estrellasGanadas,
  insigniasDe,
  rachaActual,
  saldoDeEstrellas,
} from "@/dominio/premios";
import { EditarPremio } from "./editar";
import { useHogar } from "./proveedor-hogar";

/**
 * Estrellas y premios de una persona en el zafarrancho (D-117). Cada tarea hecha vale una estrella;
 * los premios los fija la familia. Sin comparaciones entre personas: cada una ve solo lo suyo.
 */
export function PremiosPersona({
  personaId,
  nombre,
  editando,
}: {
  personaId: string;
  nombre: string;
  editando: boolean;
}) {
  const { estado, despachar } = useHogar();
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCoste, setNuevoCoste] = useState("5");
  const [nuevoEmoji, setNuevoEmoji] = useState("🎁");
  const [editandoPremio, setEditandoPremio] = useState<string | null>(null);

  const saldo = saldoDeEstrellas(estado.tareas, estado.canjes, personaId);
  const ganadas = estrellasGanadas(estado.tareas, personaId);
  const suyos = estado.canjes
    .filter((c) => c.personaId === personaId)
    .slice(-5)
    .reverse();
  const siguiente = estado.premios.find((p) => p.coste > saldo);
  const racha = rachaActual(estado.tareas, personaId, estado.hoy);
  const insignias = insigniasDe(estado.tareas, personaId);

  function anadir(evento: FormEvent) {
    evento.preventDefault();
    despachar({
      tipo: "premio/guardar",
      nombre: nuevoNombre,
      coste: Number(nuevoCoste),
      emoji: nuevoEmoji,
    });
    setNuevoNombre("");
  }

  return (
    <section aria-labelledby="premios-persona" className="tarjeta flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="premios-persona" className="text-lg font-extrabold">
          Estrellas de {nombre}
        </h2>
        <p
          className="text-2xl font-extrabold tabular-nums"
          aria-label={`${saldo} estrellas para gastar`}
        >
          <span aria-hidden="true">⭐ </span>
          {saldo}
        </p>
      </div>
      <p className="text-tinta-suave text-base">
        Cada tarea hecha vale una estrella. Ha ganado {ganadas} en total.
        {siguiente && ` Le faltan ${siguiente.coste - saldo} para «${siguiente.nombre}».`}
      </p>

      {siguiente && (
        <progress
          max={siguiente.coste}
          value={saldo}
          aria-label={`Camino hacia ${siguiente.nombre}`}
          className="h-3 w-full overflow-hidden rounded-full accent-[var(--marca)]"
        />
      )}
      {racha > 0 && (
        <p className="text-base font-semibold">
          <span aria-hidden="true">🔥 </span>
          {racha} {racha === 1 ? "día seguido" : "días seguidos"} haciendo tareas
        </p>
      )}

      {estado.premios.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-base">Todavía no hay premios. Poned los que queráis.</p>
          <button
            type="button"
            className="boton self-start"
            onClick={() => despachar({ tipo: "premio/ejemplos" })}
          >
            Poner premios de ejemplo
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {estado.premios.map((p) => {
            const puede = saldo >= p.coste;
            if (editando && editandoPremio === p.id) {
              return (
                <li key={p.id}>
                  <EditarPremio premio={p} alCerrar={() => setEditandoPremio(null)} />
                </li>
              );
            }
            return (
              <li key={p.id} className="flex items-center gap-2">
                <span className="text-3xl" aria-hidden="true">
                  {p.emoji}
                </span>
                <span className="min-w-0 flex-1 text-base font-semibold">
                  {p.nombre}
                  <span className="text-tinta-suave block text-sm font-normal">
                    {p.coste} ⭐{!puede && ` · te faltan ${p.coste - saldo}`}
                  </span>
                </span>
                {editando ? (
                  <>
                    <button
                      type="button"
                      className="boton-suave shrink-0"
                      aria-label={`Editar el premio ${p.nombre}`}
                      onClick={() => setEditandoPremio(p.id)}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="boton-suave shrink-0"
                      aria-label={`Quitar el premio ${p.nombre}`}
                      onClick={() => despachar({ tipo: "premio/borrar", id: p.id })}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={puede ? "boton shrink-0" : "boton-suave shrink-0"}
                    disabled={!puede}
                    aria-label={`Canjear ${p.nombre} (${p.coste} estrellas)`}
                    onClick={() => despachar({ tipo: "premio/canjear", premioId: p.id, personaId })}
                  >
                    Canjear
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editando && (
        <form onSubmit={anadir} className="flex flex-col gap-2" aria-label="Añadir un premio">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="premio-emoji">
              Dibujo del premio
            </label>
            <input
              id="premio-emoji"
              className="campo w-16 text-center text-xl"
              value={nuevoEmoji}
              maxLength={8}
              onChange={(e) => setNuevoEmoji(e.target.value)}
            />
            <label className="sr-only" htmlFor="premio-nombre">
              Nombre del premio
            </label>
            <input
              id="premio-nombre"
              className="campo min-w-0 flex-1"
              placeholder="Elegir la peli…"
              value={nuevoNombre}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => setNuevoNombre(e.target.value)}
            />
            <label className="sr-only" htmlFor="premio-coste">
              Estrellas que cuesta
            </label>
            <input
              id="premio-coste"
              className="campo w-20"
              type="number"
              inputMode="numeric"
              min={COSTE_MINIMO}
              max={COSTE_MAXIMO}
              value={nuevoCoste}
              onChange={(e) => setNuevoCoste(e.target.value)}
            />
          </div>
          <button type="submit" className="boton self-start" disabled={nuevoNombre.trim() === ""}>
            Añadir premio
          </button>
        </form>
      )}

      <div>
        <h3 className="text-tinta-suave text-sm font-bold">Insignias</h3>
        <ul className="flex flex-wrap gap-2">
          {insignias.map((i) => (
            <li
              key={i.id}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
                i.conseguida ? "bg-suave-2 font-semibold" : "text-tinta-suave border border-dashed"
              }`}
            >
              <span aria-hidden="true">{i.conseguida ? i.emoji : "🔒"}</span>
              <span>
                {i.nombre}
                <span className="sr-only">
                  {i.conseguida ? " (conseguida)" : ` (por conseguir: ${i.como})`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {suyos.length > 0 && (
        <div>
          <h3 className="text-tinta-suave text-sm font-bold">Conseguidos</h3>
          <ul>
            {suyos.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-base">
                <span className="min-w-0">
                  {c.nombre} <span className="text-tinta-suave text-sm">· {c.fecha}</span>
                </span>
                <button
                  type="button"
                  className="boton-suave shrink-0"
                  aria-label={`Devolver ${c.nombre}`}
                  onClick={() => despachar({ tipo: "premio/devolver", canjeId: c.id })}
                >
                  Devolver
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
