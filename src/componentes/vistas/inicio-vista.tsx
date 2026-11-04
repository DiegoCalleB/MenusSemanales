"use client";

import Link from "next/link";
import { useState } from "react";
import { articulosPendientes, comidasDe, proximoDiaConCole } from "@/aplicacion/estado";
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
import { almuerzosDe } from "@/dominio/almuerzos";
import { quePideHoy } from "@/dominio/casa";
import { resumenDeTareas } from "@/dominio/tareas";
import { CintaAnimal } from "../cinta-animal";
import { LoDeHoy } from "../lo-de-hoy";
import { NuevaCita } from "../nueva-cita";

/** Portada: arriba, la cena y el cole de hoy; después lo pendiente y, plegado, lo demás. */
export function InicioVista() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const [apuntandoCita, setApuntandoCita] = useState(false);
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  const misTareas = yo ? resumenDeTareas(estado.tareas, yo.id, estado.hoy) : null;
  const cenas = comidasDe(estado, estado.hoy);
  const cena = cenas[0];
  const deGoogle = useCalendarioFamilia(estado.hoy);
  const proximos = cuentaAtras(estado.cumples, estado.eventos, estado.hoy, {
    externos: [
      ...estado.agenda.map((a) => ({
        fecha: a.fecha,
        titulo: a.titulo,
        hora: a.hora,
        hasta: a.hasta,
      })),
      ...deGoogle,
    ],
  });
  const diaCole = proximoDiaConCole(estado, estado.hoy);
  // A quien cumple no se le enseñan los avisos de su propio regalo.
  const avisosCumples = cumplesProximos(estado).filter((a) => !yo || a.cumple.personaId !== yo.id);

  // Lo recurrente de la casa que toca ya: lo mío y lo de los dos (lo de otro no se enseña aquí).
  const casaHoy = quePideHoy(estado.casa, estado.hoy).filter(
    (t) => t.responsableId === null || t.responsableId === yo?.id,
  );

  const porComprar =
    articulosPendientes(estado).length + estado.manuales.filter((m) => !m.comprado).length;
  const comidaHoy = almuerzosDe(estado.almuerzos, estado.hoy);
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
              {p.titulo}
              {p.hora && ` (${p.hora})`} · {p.dias <= 1 ? p.texto : `en ${p.texto}`}
            </li>
          ))}
        </ul>
      )}
      <section
        aria-labelledby="hoy"
        className="from-suave-1 to-suave-2 border-borde flex flex-col gap-3 overflow-hidden rounded-3xl border bg-linear-to-br p-4 sm:p-6"
      >
        <CintaAnimal className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6" />
        <p className="text-tinta-suave text-base font-semibold">
          {yo ? `¡Hola, ${yo.nombre}! 👋` : "¡Hola! 👋"}
        </p>
        <h1 id="hoy" className="text-2xl font-extrabold tracking-tight">
          {cena ? "Hoy cenáis…" : "¿Qué cenamos hoy?"}
        </h1>
        {comidaHoy.length > 0 && (
          <p className="text-base font-semibold">
            <span aria-hidden="true">☀️ </span>Comida: {comidaHoy.map((a) => a.texto).join(" + ")}
          </p>
        )}
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

      <AyudaInstalarIos />

      {estado.personas.some((p) => p.activa) && <LoDeHoy />}

      {casaHoy.length > 0 && (
        <section aria-labelledby="casa-hoy" className="tarjeta flex flex-col gap-2">
          <h2 id="casa-hoy" className="text-lg font-extrabold">
            🏠 Hoy toca en casa
          </h2>
          <ul className="flex flex-col gap-2">
            {casaHoy.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-base font-semibold">
                  <span aria-hidden="true">{t.emoji} </span>
                  {t.titulo}
                </span>
                <button
                  type="button"
                  className="boton"
                  aria-label={`Marcar hecha: ${t.titulo}`}
                  onClick={() => despachar({ tipo: "casa/hecha", id: t.id })}
                >
                  ✓ Hecha
                </button>
              </li>
            ))}
          </ul>
          <Link href="/casa" className="boton-suave w-fit">
            {casaHoy.length > 3 ? `Ver las ${casaHoy.length}` : "Ver la casa"}
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

      {porComprar > 0 && (
        <Link href="/compra" className="tarjeta flex items-center justify-between gap-3">
          <span className="text-base font-bold">
            <span aria-hidden="true">🛒 </span>Falta por comprar
          </span>
          <span className="text-base font-semibold tabular-nums">{porComprar}</span>
        </Link>
      )}

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

      <section aria-labelledby="cita-rapida" className="tarjeta flex flex-col gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="cita-rapida" className="text-lg font-extrabold">
            Citas y eventos
          </h2>
          <div className="flex gap-2">
            {!apuntandoCita && (
              <button type="button" className="boton" onClick={() => setApuntandoCita(true)}>
                ＋ Cita
              </button>
            )}
            <Link href="/calendario" className="boton-suave">
              📅 Calendario
            </Link>
          </div>
        </div>
        {apuntandoCita && <NuevaCita alGuardar={() => setApuntandoCita(false)} />}
      </section>

      {yo?.id === "diego" && (
        <Link href="/regalo" className="boton-suave w-fit">
          <span aria-hidden="true">🎁</span> Preparar un regalo
        </Link>
      )}
    </div>
  );
}
