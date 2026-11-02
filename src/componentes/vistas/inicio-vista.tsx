"use client";

import Link from "next/link";
import { comidasDe, proximoDiaConCole } from "@/aplicacion/estado";
import { diasEntre } from "@/dominio/fechas";
import { TarjetaCole, fechaCorta } from "../cole";
import { EMOJI_GRUPO } from "../formato";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";
import { resumenDeTareas } from "@/dominio/tareas";

/** Portada: una sola pantalla, sin desplazarse: la cena de hoy, el cole de hoy y los accesos. */
export function InicioVista() {
  const { estado } = useHogar();
  const [yoId, fijarYo] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  const adultos = estado.personas.filter((p) => p.tipo === "adulto" && p.activa);
  const misTareas = yo ? resumenDeTareas(estado.tareas, yo.id, estado.hoy) : null;
  const cenas = comidasDe(estado, estado.hoy);
  const cena = cenas[0];
  const proximo = Object.entries(estado.eventos)
    .filter(([f]) => f >= estado.hoy && diasEntre(estado.hoy, f) <= 14)
    .sort(([a], [b]) => a.localeCompare(b))[0];
  const faltan = proximo ? diasEntre(estado.hoy, proximo[0]) : 0;
  const diaCole = proximoDiaConCole(estado, estado.hoy);

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="hoy"
        className="from-suave-1 to-suave-2 border-borde flex flex-col gap-3 rounded-3xl border bg-linear-to-br p-4 sm:p-6"
      >
        <p className="text-tinta-suave text-base font-semibold">
          {yo ? `¡Hola, ${yo.nombre}! 👋` : "¡Hola! 👋"}
          {proximo && (
            <span className="bg-superficie/80 ml-2 inline-block rounded-full px-3 py-0.5 font-bold">
              <span aria-hidden="true">{proximo[1].emoji} </span>
              {proximo[1].titulo} ·{" "}
              {faltan === 0 ? "¡hoy!" : faltan === 1 ? "mañana" : `en ${faltan} días`}
            </span>
          )}
        </p>
        <h1 id="hoy" className="text-2xl font-extrabold tracking-tight">
          {cena ? "Hoy cenáis…" : "¿Qué cenamos hoy?"}
        </h1>
        {cena && (
          <p className="flex items-center gap-2 text-xl font-bold">
            <span aria-hidden="true" className="text-3xl">
              {EMOJI_GRUPO[(cena.plato as { grupo?: string }).grupo ?? "otro"] ?? "🍽️"}
            </span>
            {cenas.map((c) => c.plato.nombre).join(" + ")}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href="/menu" className="boton">
            {cena ? "Ver el menú" : "Elegir la cena"}
          </Link>
          <Link href="/menu/emergencia" className="boton-suave">
            Hoy llego tarde
          </Link>
          <Link href="/tareas" className="boton-suave">
            🧹 Zafarrancho
          </Link>
        </div>
      </section>

      {!yo && adultos.length > 0 && (
        <section aria-labelledby="quien" className="tarjeta flex flex-col gap-2">
          <h2 id="quien" className="text-lg font-extrabold">
            ¿Quién eres?
          </h2>
          <p className="text-tinta-suave text-base">
            Así te saludo y te enseño tus tareas. Solo se guarda en este móvil.
          </p>
          <div className="flex flex-wrap gap-2">
            {adultos.map((p) => (
              <button key={p.id} type="button" className="boton" onClick={() => fijarYo(p.id)}>
                Soy {p.nombre}
              </button>
            ))}
          </div>
        </section>
      )}

      {yo && misTareas && misTareas.total > 0 && (
        <Link href="/tareas" className="tarjeta flex items-center justify-between gap-3">
          <span className="text-base font-bold">
            <span aria-hidden="true">🧹 </span>Tus tareas de hoy
          </span>
          <span className="text-base font-semibold tabular-nums">
            {misTareas.hechas} de {misTareas.total}
          </span>
        </Link>
      )}

      {diaCole && (
        <section aria-labelledby="cole-hoy" className="flex flex-col gap-2">
          <h2 id="cole-hoy" className="text-lg font-extrabold">
            {diaCole === estado.hoy
              ? "Hoy en el cole"
              : `Próximo menú del cole · ${fechaCorta(diaCole)}`}
          </h2>
          <TarjetaCole cole={estado.colegio[diaCole] ?? null} fecha={diaCole} />
        </section>
      )}

      {yo?.id === "diego" && (
        <Link href="/regalo" className="boton-suave w-fit">
          <span aria-hidden="true">🎁</span> Preparar un regalo
        </Link>
      )}
    </div>
  );
}
