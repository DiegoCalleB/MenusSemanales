"use client";

import Link from "next/link";
import { comidasDe, proximoDiaConCole } from "@/aplicacion/estado";
import { cuentaAtras } from "@/dominio/cuenta-atras";
import { TarjetaCole, fechaCorta } from "../cole";
import { EMOJI_GRUPO } from "../formato";
import { cumplesProximos } from "@/aplicacion/estado";
import { TEXTO_URGENCIA, felicitacionesDeHoy } from "@/dominio/cumples";
import { enlaceWhatsApp } from "@/dominio/compartir";
import { useHogar } from "../proveedor-hogar";
import { AyudaInstalarIos } from "../instalar-ios";
import { useYo } from "../yo";
import { useCalendarioFamilia } from "../usar-calendario-familia";
import { resumenDeTareas } from "@/dominio/tareas";

/** Portada: una sola pantalla, sin desplazarse: la cena de hoy, el cole de hoy y los accesos. */
export function InicioVista() {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  const misTareas = yo ? resumenDeTareas(estado.tareas, yo.id, estado.hoy) : null;
  const cenas = comidasDe(estado, estado.hoy);
  const cena = cenas[0];
  const deGoogle = useCalendarioFamilia(estado.hoy);
  const proximos = cuentaAtras(estado.cumples, estado.eventos, estado.hoy, { externos: deGoogle });
  const diaCole = proximoDiaConCole(estado, estado.hoy);
  // A quien cumple no se le enseñan los avisos de su propio regalo.
  const avisosCumples = cumplesProximos(estado).filter((a) => !yo || a.cumple.personaId !== yo.id);

  const felicitaciones = felicitacionesDeHoy(estado.cumples, estado.hoy);

  return (
    <div className="flex flex-col gap-4">
      {felicitaciones.map((f) => {
        const esMio = !!yo && f.cumple.personaId === yo.id;
        return (
          <section
            key={f.cumple.id}
            aria-label={`Cumpleaños de ${f.cumple.nombre}`}
            className="from-suave-2 to-suave-3 border-borde flex flex-col gap-2 rounded-3xl border bg-linear-to-br p-4 text-center sm:p-6"
          >
            <p aria-hidden="true" className="fiesta text-5xl">
              🎂
            </p>
            <h2 className="text-2xl font-extrabold">
              {esMio ? `¡Feliz cumpleaños, ${f.cumple.nombre}!` : `Hoy cumple ${f.cumple.nombre}`}
            </h2>
            <p className="text-base font-semibold">{esMio ? f.paraEl : f.paraLosDemas}</p>
            {!esMio && (
              <a
                className="boton mx-auto"
                href={enlaceWhatsApp(f.mensaje)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Felicitar por WhatsApp
              </a>
            )}
          </section>
        );
      })}
      {proximos.length > 0 && (
        <ul aria-label="Cuenta atrás" className="flex flex-wrap gap-2">
          {proximos.map((p) => (
            <li
              key={p.clave}
              className="bg-suave-1 border-borde rounded-full border px-3 py-1 text-sm font-bold"
            >
              <span aria-hidden="true">{p.emoji} </span>
              {p.titulo} · {p.dias <= 1 ? p.texto : `en ${p.texto}`}
            </li>
          ))}
        </ul>
      )}
      <section
        aria-labelledby="hoy"
        className="from-suave-1 to-suave-2 border-borde flex flex-col gap-3 rounded-3xl border bg-linear-to-br p-4 sm:p-6"
      >
        <p className="text-tinta-suave text-base font-semibold">
          {yo ? `¡Hola, ${yo.nombre}! 👋` : "¡Hola! 👋"}
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
          <Link href="/cumples" className="boton-suave">
            🎂 Cumples
          </Link>
        </div>
      </section>

      <AyudaInstalarIos />

      {avisosCumples.length > 0 && (
        <section aria-labelledby="cumples" className="tarjeta flex flex-col gap-2">
          <h2 id="cumples" className="text-lg font-extrabold">
            🎁 Próximos cumples
          </h2>
          <ul className="flex flex-col gap-1">
            {avisosCumples.slice(0, 3).map((a) => (
              <li key={a.cumple.id} className="text-base">
                <strong>{a.cumple.nombre}</strong>
                {a.edad !== null && ` (${a.edad})`} ·{" "}
                {a.dias === 0 ? "¡hoy!" : a.dias === 1 ? "mañana" : `en ${a.dias} días`}
                <span className="text-tinta-suave block text-sm">{TEXTO_URGENCIA[a.urgencia]}</span>
              </li>
            ))}
          </ul>
          <Link href="/cumples" className="boton-suave w-fit">
            Pensar los regalos
          </Link>
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
