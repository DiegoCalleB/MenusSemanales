"use client";

import Link from "next/link";
import { comidasDe, proximoDiaConCole } from "@/aplicacion/estado";
import { diasEntre } from "@/dominio/fechas";
import { TarjetaCole, fechaCorta } from "../cole";
import { EMOJI_GRUPO } from "../formato";
import { MODO_DATOS, useHogar } from "../proveedor-hogar";

/** Portada: una sola pantalla, sin desplazarse: la cena de hoy, el cole de hoy y los accesos. */
export function InicioVista() {
  const { estado } = useHogar();
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
          {MODO_DATOS === "diego" ? "¡Hola, Diego! 👋" : "¡Hola! 👋"}
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

      {MODO_DATOS === "diego" && (
        <Link href="/regalo" className="boton-suave w-fit">
          <span aria-hidden="true">🎁</span> Preparar un regalo
        </Link>
      )}
    </div>
  );
}
