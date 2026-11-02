"use client";

import { type FormEvent, useState } from "react";
import {
  type Cumple,
  type EstadoRegalo,
  type Relacion,
  TEXTO_URGENCIA,
  diasHasta,
  edadQueCumple,
  estadoVigente,
  parsearFecha,
  proximaFecha,
  urgenciaDe,
} from "@/dominio/cumples";
import { ideasDeRegalo } from "@/dominio/ideas-regalo";
import { claveArticulo } from "@/dominio/habituales";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const RELACIONES: Array<[Relacion, string]> = [
  ["familia", "Familia"],
  ["amigo", "Amigo/a"],
  ["cole", "Del cole"],
  ["otro", "Otro"],
];
const ESTADOS: Array<[EstadoRegalo, string]> = [
  ["sin-pensar", "Sin pensar"],
  ["idea", "Con idea"],
  ["comprado", "Comprado"],
  ["entregado", "Entregado"],
];

const fechaLarga = (c: Cumple, hoy: string) => {
  const f = proximaFecha(c, hoy);
  return `${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
};
const cuando = (d: number) => (d === 0 ? "¡hoy!" : d === 1 ? "mañana" : `en ${d} días`);

/** Cumpleaños de todos y ayuda para pensar los regalos con tiempo (D-068). */
export function CumplesVista() {
  const { estado, despachar } = useHogar();
  const [yo] = useYo();
  const [abierto, setAbierto] = useState<string | null>(null);
  const ordenados = [...estado.cumples].sort(
    (a, b) => diasHasta(a, estado.hoy) - diasHasta(b, estado.hoy),
  );
  const sinFecha = estado.personas.filter(
    (p) => p.activa && !estado.cumples.some((c) => c.personaId === p.id),
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Cumples y regalos <span aria-hidden="true">🎂</span>
        </h1>
      </header>

      <Alta sinFecha={sinFecha.map((p) => p.nombre)} />

      {ordenados.length === 0 ? (
        <p className="tarjeta text-base">
          Aún no hay cumpleaños. Añade los de la familia, los amigos y los del cole: un mes antes os
          aviso para ir pensando el regalo.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenados.map((c) => {
            const dias = diasHasta(c, estado.hoy);
            const urg = urgenciaDe(dias);
            const edad = edadQueCumple(c, estado.hoy);
            const est = estadoVigente(c, estado.hoy);
            const abiertoAhora = abierto === c.id;
            const esMio = Boolean(yo) && c.personaId === yo;
            return (
              <li key={c.id} className="tarjeta p-0">
                <h2>
                  <button
                    type="button"
                    aria-expanded={abiertoAhora}
                    onClick={() => setAbierto(abiertoAhora ? null : c.id)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                  >
                    <span className="w-14 shrink-0 text-center leading-tight" aria-hidden="true">
                      <span className="block text-2xl font-extrabold">
                        {fechaLarga(c, estado.hoy).split(" ")[0]}
                      </span>
                      <span className="block text-sm font-semibold uppercase">
                        {fechaLarga(c, estado.hoy).split(" ")[1]}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold">
                        {c.nombre}
                        {edad !== null && ` · ${edad} años`}
                      </span>
                      <span className="text-tinta-suave block text-sm">
                        {cuando(dias)}
                        {urg !== "lejos" && !esMio && ` · ${TEXTO_URGENCIA[urg]}`}
                      </span>
                    </span>
                    {!esMio && est !== "sin-pensar" && (
                      <span className="etiqueta bg-ok-fondo text-ok-texto shrink-0">
                        {ESTADOS.find(([v]) => v === est)?.[1]}
                      </span>
                    )}
                    <span aria-hidden="true" className="text-xl">
                      {abiertoAhora ? "▴" : "▾"}
                    </span>
                  </button>
                </h2>
                {abiertoAhora && (
                  <div className="flex flex-col gap-3 px-4 pb-4">
                    {esMio ? (
                      <p className="bg-suave-1 rounded-2xl p-3 text-base font-semibold">
                        🙈 Es sorpresa: a quien cumple no se le enseñan las ideas ni el regalo.
                      </p>
                    ) : (
                      <Detalle c={c} edad={edad} estadoActual={est} />
                    )}
                    <button
                      type="button"
                      className="boton-suave w-fit"
                      aria-label={`Quitar el cumpleaños de ${c.nombre}`}
                      onClick={() => despachar({ tipo: "cumple/borrar", id: c.id })}
                    >
                      Quitar cumpleaños
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detalle({
  c,
  edad,
  estadoActual,
}: {
  c: Cumple;
  edad: number | null;
  estadoActual: EstadoRegalo;
}) {
  const { despachar } = useHogar();
  const [idea, setIdea] = useState("");
  const propuestas = ideasDeRegalo({ edad, relacion: c.relacion, gustos: c.gustos }).filter(
    (i) => !c.ideas.some((x) => claveArticulo(x) === claveArticulo(i)),
  );
  function anadir(e: FormEvent) {
    e.preventDefault();
    despachar({ tipo: "cumple/idea", id: c.id, texto: idea });
    setIdea("");
  }
  return (
    <>
      <div role="group" aria-label="Estado del regalo" className="flex flex-wrap gap-2">
        {ESTADOS.map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={estadoActual === valor}
            className={estadoActual === valor ? "boton" : "boton-suave"}
            onClick={() => despachar({ tipo: "cumple/estado", id: c.id, estado: valor })}
          >
            {texto}
          </button>
        ))}
      </div>

      <section aria-label={`Ideas para ${c.nombre}`} className="flex flex-col gap-2">
        <h3 className="text-base font-bold">🎁 Ideas para {c.nombre}</h3>
        {c.ideas.length > 0 && (
          <ul className="flex flex-col gap-1">
            {c.ideas.map((i) => (
              <li
                key={i}
                className="bg-fondo flex items-center justify-between gap-2 rounded-2xl px-3 py-1"
              >
                <span className="text-base">{i}</span>
                <button
                  type="button"
                  className="boton-suave"
                  aria-label={`Quitar la idea ${i}`}
                  onClick={() => despachar({ tipo: "cumple/quitarIdea", id: c.id, texto: i })}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={anadir} className="flex gap-2" aria-label="Añadir idea">
          <label htmlFor={`idea-${c.id}`} className="sr-only">
            Añadir una idea para {c.nombre}
          </label>
          <input
            id={`idea-${c.id}`}
            className="campo flex-1"
            placeholder="Una idea…"
            maxLength={120}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <button type="submit" className="boton" disabled={idea.trim() === ""}>
            Añadir
          </button>
        </form>
        {propuestas.length > 0 && (
          <>
            <p className="text-tinta-suave text-sm">
              Ideas para empezar (según la edad y sus gustos):
            </p>
            <ul className="flex flex-wrap gap-2">
              {propuestas.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    className="boton-suave"
                    onClick={() => despachar({ tipo: "cumple/idea", id: c.id, texto: p })}
                  >
                    + {p}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

function Alta({ sinFecha }: { sinFecha: string[] }) {
  const { despachar } = useHogar();
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [relacion, setRelacion] = useState<Relacion>("familia");
  const [gustos, setGustos] = useState("");
  const [varios, setVarios] = useState("");
  const [problema, setProblema] = useState("");

  function guardar(e: FormEvent) {
    e.preventDefault();
    const f = parsearFecha(fecha);
    if (!f) {
      setProblema("No entiendo la fecha. Escríbela así: 12/3/2017 (o 12/3 si no sabes el año).");
      return;
    }
    setProblema("");
    despachar({
      tipo: "cumple/anadir",
      nombre,
      relacion,
      gustos: gustos.split(","),
      ...f,
    });
    setNombre("");
    setFecha("");
    setGustos("");
  }

  return (
    <section className="tarjeta flex flex-col gap-3" aria-labelledby="alta">
      <h2 id="alta" className="text-lg font-extrabold">
        Añadir un cumpleaños
      </h2>
      {sinFecha.length > 0 && (
        <p className="text-tinta-suave text-base">
          Faltan las fechas de:{" "}
          {sinFecha.map((n) => (
            <button key={n} type="button" className="boton-suave mr-2" onClick={() => setNombre(n)}>
              {n}
            </button>
          ))}
        </p>
      )}
      <form onSubmit={guardar} className="flex flex-col gap-2" aria-label="Nuevo cumpleaños">
        <label className="flex flex-col gap-1 text-base font-semibold">
          Nombre
          <input
            className="campo"
            maxLength={60}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-base font-semibold">
          Fecha (día/mes/año)
          <input
            className="campo"
            inputMode="numeric"
            placeholder="12/3/2017"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-base font-semibold">
          Relación
          <select
            className="campo"
            value={relacion}
            onChange={(e) => setRelacion(e.target.value as Relacion)}
          >
            {RELACIONES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-base font-semibold">
          Le gusta… (opcional, separado por comas)
          <input
            className="campo"
            placeholder="manualidades, gatos"
            value={gustos}
            onChange={(e) => setGustos(e.target.value)}
          />
        </label>
        {problema && (
          <p role="alert" className="bg-peligro-fondo text-peligro-texto rounded-2xl p-3 text-base">
            {problema}
          </p>
        )}
        <button
          type="submit"
          className="boton w-fit"
          disabled={nombre.trim() === "" || fecha.trim() === ""}
        >
          Guardar cumpleaños
        </button>
      </form>

      <details>
        <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
          Pegar varios de una vez
        </summary>
        <div className="flex flex-col gap-2 pb-2">
          <label htmlFor="varios" className="text-tinta-suave text-base">
            Uno por línea: «Alba 12/3/2017», «Abuela Rosa 20 de enero»…
          </label>
          <textarea
            id="varios"
            className="campo min-h-28 py-2"
            maxLength={3000}
            value={varios}
            onChange={(e) => setVarios(e.target.value)}
          />
          <button
            type="button"
            className="boton w-fit"
            disabled={varios.trim() === ""}
            onClick={() => {
              despachar({ tipo: "cumple/importar", texto: varios, relacion });
              setVarios("");
            }}
          >
            Guardar todos
          </button>
        </div>
      </details>
    </section>
  );
}
