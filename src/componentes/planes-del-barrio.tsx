"use client";

import { useState } from "react";
import type { PlanBarrio } from "@/dominio/barrio";
import { useHogar } from "./proveedor-hogar";
import { usePlanesDelBarrio } from "./usar-barrio";

const fechaCorta = (f: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${f}T12:00:00Z`));

const DE_UNA_VEZ = 8;

/**
 * Planes del barrio (D-165): la agenda cultural del Ayuntamiento de San Blas-Canillejas (bibliotecas,
 * centros culturales, Quinta de los Molinos…), de hoy en adelante, con «Solo para la familia».
 * Sin conexión o si la agenda falla, no ocupa sitio.
 */
export function PlanesDelBarrio() {
  const { estado } = useHogar();
  const planes = usePlanesDelBarrio();
  // Plegada por defecto (D-165): la página de Fechas no debe llenarse de planes del barrio.
  const [abierta, setAbierta] = useState(false);
  const [soloFamilia, setSoloFamilia] = useState(false);
  const [cuantos, setCuantos] = useState(DE_UNA_VEZ);
  const lista = planes.filter(
    (p) => (p.hasta ?? p.fecha) >= estado.hoy && (!soloFamilia || p.familiar),
  );
  if (planes.length === 0) return null;

  const deFamilia = planes.filter((p) => (p.hasta ?? p.fecha) >= estado.hoy && p.familiar).length;

  return (
    <section aria-labelledby="planes-barrio" className="tarjeta flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls="planes-barrio-lista"
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
        onClick={() => setAbierta((a) => !a)}
      >
        <span id="planes-barrio" className="text-xl font-extrabold">
          <span aria-hidden="true">🏘️ </span>Planes del barrio
          <span className="text-tinta-suave text-base font-medium">
            {" "}
            · {lista.length}
            {deFamilia > 0 ? ` (${deFamilia} para la familia)` : ""}
          </span>
        </span>
        <span aria-hidden="true" className="text-xl">
          {abierta ? "▴" : "▾"}
        </span>
      </button>
      {abierta && (
        <div id="planes-barrio-lista" className="flex flex-col gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base">
            <input
              type="checkbox"
              className="size-5 accent-[var(--marca)]"
              checked={soloFamilia}
              onChange={(e) => {
                setSoloFamilia(e.target.checked);
                setCuantos(DE_UNA_VEZ);
              }}
            />
            Solo para la familia
          </label>
          {lista.length === 0 ? (
            <p className="text-tinta-suave text-base">Nada por ahora con ese filtro.</p>
          ) : (
            <ul aria-label="Planes del barrio" className="flex flex-col gap-2">
              {lista.slice(0, cuantos).map((p) => (
                <Plan key={`${p.id}-${p.fecha}`} p={p} />
              ))}
            </ul>
          )}
          {lista.length > cuantos && (
            <button
              type="button"
              className="boton-suave w-fit"
              onClick={() => setCuantos((n) => n + DE_UNA_VEZ)}
            >
              Ver más ({lista.length - cuantos})
            </button>
          )}
          <p className="text-tinta-suave text-sm">
            Agenda cultural del Ayuntamiento de Madrid, distrito de San Blas-Canillejas.
          </p>
        </div>
      )}
    </section>
  );
}

function Plan({ p }: { p: PlanBarrio }) {
  return (
    <li className="bg-suave-1 flex flex-col gap-0.5 rounded-2xl p-3">
      <p className="text-base font-semibold">
        <span aria-hidden="true">{p.emoji} </span>
        {p.enlace ? (
          <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="underline">
            {p.titulo}
          </a>
        ) : (
          p.titulo
        )}
      </p>
      <p className="text-tinta-suave text-sm">
        {fechaCorta(p.fecha)}
        {p.hasta ? ` – ${fechaCorta(p.hasta)}` : ""}
        {p.hora ? ` · ${p.hora}` : ""}
        {p.lugar
          ? ` · ${p.lugar.replace(/^(Centro Cultural|Biblioteca Pública Municipal) /, "")}`
          : ""}
        {p.barrio ? ` (${p.barrio})` : ""}
        {` · ${p.gratis ? "gratis" : (p.precio ?? "de pago")}`}
        {p.familiar ? " · 👨‍👩‍👧 familia" : ""}
      </p>
    </li>
  );
}
