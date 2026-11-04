"use client";

import { type FormEvent, useState } from "react";
import type { FrecuenciaTarea } from "@/dominio/tareas";
import { estaHecha, resumenDeTareas, tareasDeHoy } from "@/dominio/tareas";
import { saldoDeEstrellas } from "@/dominio/premios";
import { PremiosPersona } from "@/componentes/premios-persona";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

/**
 * Las tareas de cada persona de la familia: rutinas que se repiten cada día (dientes, hacer la
 * cama) y cosas puntuales (un examen, bajar las sillas). Sin puntos ni comparaciones: solo hacer
 * visible lo que cada uno tiene entre manos. Se llama «día de zafarrancho» (D-062): todos a la vez,
 * cada uno con su lista, y el progreso de la familia a la vista.
 */
export function TareasVista() {
  const { estado, despachar } = useHogar();
  const personas = estado.personas.filter((p) => p.activa);
  const [yo] = useYo();
  const [elegida, setPersonaId] = useState<string | null>(null);
  // Por defecto, las tareas de quien usa este móvil.
  const personaId = elegida ?? (personas.some((p) => p.id === yo) ? yo : (personas[0]?.id ?? ""));
  const [texto, setTexto] = useState("");
  const [frecuencia, setFrecuencia] = useState<FrecuenciaTarea>("puntual");
  const [editando, setEditando] = useState(false);

  const persona = personas.find((p) => p.id === personaId) ?? personas[0];
  if (!persona) return null;
  const tareas = tareasDeHoy(estado.tareas, persona.id, estado.hoy);
  const { total, hechas } = resumenDeTareas(estado.tareas, persona.id, estado.hoy);
  const familia = personas.map((p) => resumenDeTareas(estado.tareas, p.id, estado.hoy));
  const totalFamilia = familia.reduce((suma, r) => suma + r.total, 0);
  const hechasFamilia = familia.reduce((suma, r) => suma + r.hechas, 0);

  function anadir(evento: FormEvent) {
    evento.preventDefault();
    if (!persona) return;
    despachar({ tipo: "tarea/anadir", personaId: persona.id, texto, frecuencia });
    setTexto("");
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Día de zafarrancho <span aria-hidden="true">🧹</span>
        </h1>
        <button
          type="button"
          className={editando ? "boton" : "boton-suave"}
          aria-pressed={editando}
          onClick={() => setEditando((v) => !v)}
        >
          {editando ? "Listo" : "Editar"}
        </button>
      </header>

      <div className="flex items-center gap-3">
        <progress
          max={Math.max(totalFamilia, 1)}
          value={hechasFamilia}
          aria-label="Progreso de la familia"
          className="h-3 flex-1 overflow-hidden rounded-full accent-[var(--marca)]"
        />
        <span className="shrink-0 text-base font-semibold tabular-nums">
          Familia: {hechasFamilia} de {totalFamilia}
          {totalFamilia > 0 && hechasFamilia === totalFamilia && (
            <span aria-hidden="true"> 🎉</span>
          )}
        </span>
      </div>

      <div role="group" aria-label="Persona" className="flex flex-wrap gap-2">
        {personas.map((p) => {
          const r = resumenDeTareas(estado.tareas, p.id, estado.hoy);
          const activa = p.id === persona.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={activa}
              className={activa ? "boton" : "boton-suave"}
              onClick={() => setPersonaId(p.id)}
            >
              {p.nombre}
              <span className="text-sm font-normal">
                {r.hechas}/{r.total}
                <span aria-hidden="true">
                  {" "}
                  · ⭐{saldoDeEstrellas(estado.tareas, estado.canjes, p.id)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="tareas-persona" className="tarjeta flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="tareas-persona" className="text-lg font-extrabold">
            Tareas de {persona.nombre}
          </h2>
          <p className="text-tinta-suave text-base font-medium tabular-nums">
            {hechas} de {total}
            {total > 0 && hechas === total && <span aria-hidden="true"> 🎉</span>}
          </p>
        </div>

        {tareas.length === 0 ? (
          <p className="text-tinta-suave text-base">Nada pendiente. Añade lo que haga falta.</p>
        ) : (
          <ul>
            {tareas.map((t) => {
              const hecha = estaHecha(t, estado.hoy);
              return (
                <li key={t.id} className="flex items-center gap-1">
                  <label className="hover:bg-fondo flex min-h-14 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 py-2">
                    <input
                      type="checkbox"
                      checked={hecha}
                      onChange={() => despachar({ tipo: "tarea/alternar", id: t.id })}
                      className="size-6 shrink-0 accent-[var(--marca)]"
                    />
                    <span
                      className={`min-w-0 flex-1 text-base ${hecha ? "text-tinta-suave line-through" : ""}`}
                    >
                      {t.texto}
                    </span>
                    {t.frecuencia === "diaria" && (
                      <span className="text-tinta-suave shrink-0 text-sm">
                        <span aria-hidden="true">🔁 </span>cada día
                      </span>
                    )}
                  </label>
                  {editando && (
                    <button
                      type="button"
                      className="boton-suave shrink-0"
                      aria-label={`Quitar la tarea ${t.texto}`}
                      onClick={() => despachar({ tipo: "tarea/borrar", id: t.id })}
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={anadir} className="mt-2 flex flex-col gap-2" aria-label="Añadir una tarea">
          <label htmlFor="nueva-tarea" className="sr-only">
            Añadir una tarea a {persona.nombre}
          </label>
          <div className="flex gap-2">
            <input
              id="nueva-tarea"
              className="campo flex-1"
              placeholder="Deberes, recoger la mesa…"
              value={texto}
              maxLength={300}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => setTexto(e.target.value)}
            />
            <button type="submit" className="boton" disabled={texto.trim() === ""}>
              Añadir
            </button>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input
              type="checkbox"
              className="size-6 accent-[var(--marca)]"
              checked={frecuencia === "diaria"}
              onChange={(e) => setFrecuencia(e.target.checked ? "diaria" : "puntual")}
            />
            Se repite cada día
          </label>
        </form>
      </section>

      <PremiosPersona personaId={persona.id} nombre={persona.nombre} editando={editando} />
    </div>
  );
}
