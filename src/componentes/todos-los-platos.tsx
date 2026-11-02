"use client";

import { useId, useMemo, useState } from "react";
import { catalogoOrdenado } from "@/aplicacion/estado";
import type { FechaIso } from "@/dominio/fechas";
import { NOMBRE_GRUPO_ES } from "@/dominio/texto";
import { EMOJI_GRUPO, formatearNumero } from "./formato";
import { useHogar } from "./proveedor-hogar";

const POR_PAGINA = 10;

/**
 * Todo el catálogo para elegir la cena de un día, ordenado por lo que más conviene: primero lo que
 * encaja con el cole y con los días de al lado (lo ya comido y lo ya planificado) y después lo que
 * no, con el motivo. Se puede elegir cualquiera: la app avisa de lo que se sacrifica, no lo impide.
 */
export function TodosLosPlatos({
  fecha,
  anadir,
  alElegir,
}: {
  fecha: FechaIso;
  anadir: boolean;
  alElegir: (platoId: string) => void;
}) {
  const { estado } = useHogar();
  const id = useId();
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);
  const todos = useMemo(() => catalogoOrdenado(estado, fecha, anadir), [estado, fecha, anadir]);
  const q = busqueda.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const visibles = todos.filter(
    (o) =>
      q === "" || o.plato.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q),
  );
  const encajan = todos.filter((o) => o.compatible).length;

  return (
    <section aria-label="Todos los platos" className="flex flex-col gap-2">
      <p className="text-tinta-suave text-base">
        {todos.length} platos · <strong>{encajan}</strong> encajan. Los que encajan van primero; de
        los demás se dice qué se sacrifica.
      </p>
      <label htmlFor={`${id}-q`} className="sr-only">
        Buscar en todos los platos
      </label>
      <input
        id={`${id}-q`}
        type="search"
        className="campo"
        placeholder="Buscar un plato…"
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setLimite(POR_PAGINA);
        }}
      />
      <ul aria-label="Catálogo ordenado" className="flex flex-col gap-2">
        {visibles.slice(0, limite).map((o) => (
          <li
            key={o.plato.id}
            className={`flex flex-col gap-1 rounded-2xl border p-3 ${
              o.compatible ? "border-borde bg-fondo" : "border-borde bg-superficie opacity-95"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold">
                  <span aria-hidden="true">{EMOJI_GRUPO[o.plato.grupo]} </span>
                  {o.plato.nombre}
                </p>
                <p className="text-tinta-suave text-sm">
                  {o.plato.minutosActivos} min · {NOMBRE_GRUPO_ES[o.plato.grupo]}
                  {o.plato.valoracion !== null && ` · ★ ${formatearNumero(o.plato.valoracion)}`}
                </p>
              </div>
              <button
                type="button"
                className={o.compatible ? "boton" : "boton-suave"}
                aria-label={`${anadir ? "Añadir" : "Elegir"} ${o.plato.nombre}`}
                onClick={() => alElegir(o.plato.id)}
              >
                {anadir ? "Añadir" : "Elegir"}
              </button>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {o.compatible && <li className="etiqueta bg-ok-fondo text-ok-texto">✓ Encaja</li>}
              {o.semana?.estado === "falta" && (
                <li className="etiqueta bg-suave-3 text-tinta">
                  Os falta {o.semana.nombre} ({o.semana.n} de {o.semana.min}–{o.semana.max})
                </li>
              )}
              {o.semana?.estado === "completo" && (
                <li className="etiqueta bg-aviso-fondo text-aviso-texto">
                  Ya van {o.semana.n} de {o.semana.nombre} esta semana
                </li>
              )}
            </ul>
            {o.rechazos.length > 0 && (
              <ul className="text-aviso-texto bg-aviso-fondo flex flex-col gap-0.5 rounded-xl p-2 text-sm">
                {o.rechazos.map((r) => (
                  <li key={r.detalle}>⚠️ {r.detalle}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {visibles.length === 0 && (
        <p className="text-tinta-suave text-base">Ningún plato coincide.</p>
      )}
      {visibles.length > limite && (
        <button
          type="button"
          className="boton-suave w-fit"
          onClick={() => setLimite((l) => l + POR_PAGINA)}
        >
          Ver más ({visibles.length - limite})
        </button>
      )}
    </section>
  );
}
