"use client";

import { useState } from "react";
import type { PlanBarrio } from "@/dominio/barrio";
import { diaSemanaIso, sumarDias } from "@/dominio/fechas";
import { claveArticulo } from "@/dominio/habituales";
import { useHogar } from "../proveedor-hogar";
import { usePlanesDelBarrio } from "../usar-barrio";

const fechaLarga = (f: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${f}T12:00:00Z`));
const fechaCorta = (f: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${f}T12:00:00Z`),
  );

type Filtro = "todos" | "familia" | "gratis" | "finde";
const FILTROS: ReadonlyArray<[Filtro, string]> = [
  ["todos", "Todos"],
  ["familia", "👨‍👩‍👧 Familia"],
  ["gratis", "Gratis"],
  ["finde", "Este finde"],
];
const DE_UNA_VEZ = 15;

/** Cómo queda el plan en la agenda: «Cuentacuentos (Biblioteca Canillejas)». */
export function tituloEnLaAgenda(p: PlanBarrio): string {
  const lugar = p.lugar.replace(/^(Centro Cultural|Biblioteca Pública Municipal) /, "");
  const t = lugar ? `${p.titulo} (${lugar})` : p.titulo;
  return (t.length <= 120 ? t : p.titulo).slice(0, 120);
}

/**
 * Planes del barrio (D-167): todos los de la agenda cultural de San Blas-Canillejas, con filtros, y un
 * botón para apuntar en la agenda de la familia el que interese.
 */
export function BarrioVista() {
  const { estado, despachar } = useHogar();
  const planes = usePlanesDelBarrio();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [cuantos, setCuantos] = useState(DE_UNA_VEZ);

  const vigentes = planes.filter((p) => (p.hasta ?? p.fecha) >= estado.hoy);
  // El «viernes» de referencia para «este finde»: el de esta semana (o hoy, si ya es sábado o domingo).
  const dow = diaSemanaIso(estado.hoy);
  const viernes = dow >= 6 ? sumarDias(estado.hoy, -(dow - 5)) : sumarDias(estado.hoy, 5 - dow);
  const lista = vigentes.filter((p) =>
    filtro === "familia" ? p.familiar : filtro === "gratis" ? p.gratis : true,
  );
  // «Este finde» enseña también lo que no es de familia: se calcula aparte.
  const finde =
    filtro === "finde"
      ? vigentes.filter(
          (p) => p.fecha <= sumarDias(viernes, 2) && (p.hasta ?? p.fecha) >= sumarDias(viernes, 1),
        )
      : lista;
  const visibles = finde.slice(0, cuantos);
  const dias = [...new Set(visibles.map((p) => p.fecha))];
  const yaApuntado = (p: PlanBarrio) =>
    estado.agenda.some(
      (a) => a.fecha === p.fecha && claveArticulo(a.titulo) === claveArticulo(tituloEnLaAgenda(p)),
    );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Planes del barrio <span aria-hidden="true">🏘️</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Lo que hay cerca, en San Blas-Canillejas. Si te interesa uno, apúntalo en vuestra agenda
          con un toque.
        </p>
      </header>

      <div role="group" aria-label="Filtrar planes" className="flex flex-wrap gap-2">
        {FILTROS.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            className={filtro === id ? "boton" : "boton-suave"}
            aria-pressed={filtro === id}
            onClick={() => {
              setFiltro(id);
              setCuantos(DE_UNA_VEZ);
            }}
          >
            {texto}
          </button>
        ))}
      </div>

      {planes.length === 0 ? (
        <p className="tarjeta text-tinta-suave text-base">
          No consigo leer la agenda del Ayuntamiento ahora mismo. Vuelve a mirar dentro de un rato.
        </p>
      ) : finde.length === 0 ? (
        <p className="tarjeta text-tinta-suave text-base">Nada por ahora con ese filtro.</p>
      ) : (
        dias.map((d) => (
          <section key={d} aria-label={fechaLarga(d)} className="flex flex-col gap-2">
            <h2 className="text-lg font-bold capitalize">{fechaLarga(d)}</h2>
            <ul className="flex flex-col gap-2">
              {visibles
                .filter((p) => p.fecha === d)
                .map((p) => (
                  <li
                    key={`${p.id}-${p.fecha}`}
                    className="tarjeta flex items-start justify-between gap-2"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="text-base font-semibold">
                        <span aria-hidden="true">{p.emoji} </span>
                        {p.enlace ? (
                          <a
                            href={p.enlace}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center underline"
                            title="Buscar más información"
                          >
                            {p.titulo}
                          </a>
                        ) : (
                          p.titulo
                        )}
                      </p>
                      <p className="text-tinta-suave text-sm">
                        {p.hasta ? `hasta el ${fechaCorta(p.hasta)}` : ""}
                        {p.hasta && p.hora ? " · " : ""}
                        {p.hora ?? ""}
                        {p.hora || p.hasta ? " · " : ""}
                        {p.lugar.replace(/^(Centro Cultural|Biblioteca Pública Municipal) /, "")}
                        {p.barrio ? ` (${p.barrio})` : ""}
                        {` · ${p.gratis ? "gratis" : (p.precio ?? "de pago")}`}
                        {p.familiar ? " · 👨‍👩‍👧 familia" : ""}
                      </p>
                    </div>
                    {yaApuntado(p) ? (
                      <span className="text-tinta-suave shrink-0 self-center text-sm font-semibold">
                        ✓ Apuntado
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="boton-suave shrink-0 self-center"
                        aria-label={`Apuntar ${p.titulo} en la agenda`}
                        onClick={() =>
                          despachar({
                            tipo: "agenda/cita",
                            fecha: p.fecha,
                            hasta: p.hasta,
                            hora: p.hora,
                            titulo: tituloEnLaAgenda(p),
                            idBase: crypto.randomUUID(),
                          })
                        }
                      >
                        ＋ Apuntar
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}

      {finde.length > cuantos && (
        <button
          type="button"
          className="boton-suave w-fit"
          onClick={() => setCuantos((n) => n + DE_UNA_VEZ)}
        >
          Ver más ({finde.length - cuantos})
        </button>
      )}
      <p className="text-tinta-suave text-sm">
        Agenda cultural del Ayuntamiento de Madrid. Solo actividades municipales: no están los
        colegios ni las asociaciones.
      </p>
    </div>
  );
}
