"use client";

import Link from "next/link";
import { useMemo } from "react";
import { diasDelMenu, menuDeLaSemana, nombreDia } from "@/aplicacion/estado";
import type { Motivo, Opcion } from "@/dominio/menu";
import { EMOJI_GRUPO, formatearNumero } from "../formato";
import { IconoReloj } from "../iconos";
import { ColeVsCena, TarjetaCole } from "../cole";
import { Razones } from "../razones";
import { useHogar } from "../proveedor-hogar";

const TEXTO_MOTIVO: Record<Motivo, string> = {
  usa_caducidad: "Gasta lo que caduca",
  usa_despensa: "Ya tenéis ingredientes",
  bien_valorado: "Os gusta",
  hace_tiempo: "Hace tiempo que no lo coméis",
  novedad: "Nuevo para vosotros",
  falta_en_semana: "Os falta esta semana",
  rapido: "Rápido",
};

const NOMBRE_GRUPO: Record<string, string> = {
  carne: "carne",
  pescado: "pescado",
  legumbre: "legumbres",
  huevo: "huevos",
  pasta: "pasta",
  arroz: "arroz",
  verdura: "verdura",
  otro: "otro",
};

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Valoracion({ platoId, nombre }: { platoId: string; nombre: string }) {
  const { estado, despachar } = useHogar();
  const notas = estado.valoraciones[platoId] ?? {};
  return (
    <fieldset className="border-borde rounded-2xl border p-3">
      <legend className="px-1 text-sm font-bold">¿Qué tal estuvo? {nombre}</legend>
      <ul className="flex flex-col gap-2">
        {estado.personas
          .filter((p) => p.activa)
          .map((persona) => (
            <li key={persona.id} className="flex flex-wrap items-center gap-x-3">
              <span className="w-16 text-base font-semibold">{persona.nombre}</span>
              <span className="flex" role="group" aria-label={`Valoración de ${persona.nombre}`}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const marcada = (notas[persona.id] ?? 0) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={notas[persona.id] === n}
                      aria-label={`${persona.nombre}: ${n} ${n === 1 ? "estrella" : "estrellas"}`}
                      className="text-marca flex size-11 items-center justify-center text-2xl"
                      onClick={() =>
                        despachar({ tipo: "valorar", platoId, personaId: persona.id, puntos: n })
                      }
                    >
                      <span aria-hidden="true">{marcada ? "★" : "☆"}</span>
                    </button>
                  );
                })}
              </span>
            </li>
          ))}
      </ul>
    </fieldset>
  );
}

export function MenuVista() {
  const { estado, despachar } = useHogar();
  const dias = useMemo(() => diasDelMenu(estado), [estado]);
  const propuesta = useMemo(() => menuDeLaSemana(estado), [estado]);
  const eleccion = (fecha: string) => estado.comidas.find((c) => c.fecha === fecha);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Menú de la semana <span aria-hidden="true">🍽️</span>
        </h1>
        <p className="text-tinta-suave max-w-prose text-base">
          Para cada cena, unas pocas opciones que encajan con el tiempo de ese día y con el menú del
          cole. Elegid la que más os cuadre y la lista de la compra se actualiza sola.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="boton"
          onClick={() => despachar({ tipo: "menu/autocompletar" })}
        >
          ✨ Proponer los días sin cena
        </button>
        <div role="group" aria-label="Cuánto planificar" className="flex gap-2">
          {(
            [
              ["semana", "Esta semana"],
              ["quincena", "Próximos 15 días"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={estado.horizonte === valor}
              className={estado.horizonte === valor ? "boton" : "boton-suave"}
              onClick={() => despachar({ tipo: "menu/horizonte", horizonte: valor })}
            >
              {texto}
            </button>
          ))}
        </div>
        <Link href="/menu/platos" className="boton-suave">
          Mis platos
        </Link>
        <Link href="/menu/emergencia" className="boton-suave">
          Cena de emergencia
        </Link>
        <Link href="/menu/cole" className="boton-suave">
          Menú del cole
        </Link>
      </div>
      {estado.horizonte === "quincena" && (
        <p className="text-tinta-suave max-w-prose text-base">
          Eligiendo varias cenas puedes adelantar la compra de 15 días: la lista suma lo de todas.
        </p>
      )}

      <ColeVsCena />

      <ul className="grid gap-4 lg:grid-cols-2">
        {dias.map((dia) => {
          const elegida = eleccion(dia.fecha);
          const opciones: Opcion[] = elegida
            ? (menuDeLaSemana(estado, dia.fecha)
                .dias.find((d) => d.fecha === dia.fecha)
                ?.opciones.filter((o) => o.plato.id !== elegida.plato.id) ?? [])
            : (propuesta.dias.find((d) => d.fecha === dia.fecha)?.opciones ?? []);
          const tarde = estado.llegoTarde.includes(dia.fecha);
          const titulo = `${mayuscula(nombreDia(dia.fecha))} ${formatoFecha.format(new Date(`${dia.fecha}T00:00:00Z`))}`;
          const evento = estado.eventos[dia.fecha];
          const saltado = estado.saltados.includes(dia.fecha);
          if (saltado) {
            return (
              <li
                key={dia.fecha}
                className="tarjeta flex flex-wrap items-center justify-between gap-3 opacity-80"
              >
                <div>
                  <h2 className="text-xl font-extrabold">{titulo}</h2>
                  <p className="text-tinta-suave text-base">Sin cena en casa este día.</p>
                </div>
                <button
                  type="button"
                  className="boton-suave"
                  onClick={() => despachar({ tipo: "menu/saltar", fecha: dia.fecha })}
                >
                  Planificar este día
                </button>
              </li>
            );
          }
          return (
            <li key={dia.fecha} className="tarjeta flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold">{titulo}</h2>
                  {evento && (
                    <p className="bg-suave-1 mt-1 w-fit rounded-full px-3 py-1 text-base font-bold">
                      <span aria-hidden="true">{evento.emoji} </span>
                      {evento.titulo}
                    </p>
                  )}
                  <p className="text-tinta-suave flex items-center gap-1.5 text-base">
                    <IconoReloj width={18} height={18} />
                    Hasta {dia.minutosMax} min
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={tarde}
                  onClick={() => despachar({ tipo: "menu/llegoTarde", fecha: dia.fecha })}
                  className={tarde ? "boton" : "boton-suave"}
                >
                  Hoy llego tarde
                </button>
              </div>
              <button
                type="button"
                className="text-tinta-suave min-h-11 w-fit text-base font-semibold underline"
                onClick={() => despachar({ tipo: "menu/saltar", fecha: dia.fecha })}
              >
                No cenamos en casa este día
              </button>

              <TarjetaCole cole={dia.cole} fecha={dia.fecha} />

              {elegida && (
                <div className="bg-ok-fondo text-ok-texto flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                  <div>
                    <p className="text-sm font-bold">✓ Elegido</p>
                    <p className="text-lg font-bold">
                      <span aria-hidden="true">
                        {EMOJI_GRUPO[(elegida.plato as { grupo?: string }).grupo ?? "otro"]}{" "}
                      </span>
                      {elegida.plato.nombre}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="boton-suave"
                    onClick={() => despachar({ tipo: "menu/quitar", fecha: dia.fecha })}
                  >
                    Quitar
                  </button>
                </div>
              )}

              {elegida && propuesta.dias.find((d) => d.fecha === dia.fecha)?.opciones[0] && (
                <Razones
                  fecha={dia.fecha}
                  opcion={propuesta.dias.find((d) => d.fecha === dia.fecha)!.opciones[0]!}
                />
              )}

              {elegida && dia.fecha <= estado.hoy && (
                <Valoracion platoId={elegida.plato.id} nombre={elegida.plato.nombre} />
              )}

              {opciones.length === 0 && !elegida && (
                <p className="text-tinta-suave text-base">
                  Ningún plato cumple las reglas de este día (tiempo, cole o ingredientes). Prueba a
                  quitar «Hoy llego tarde» o a añadir platos al catálogo.
                </p>
              )}

              {opciones.length > 0 && (
                <section aria-label={`Opciones para el ${nombreDia(dia.fecha)}`}>
                  <h3 className="text-tinta-suave mb-2 text-sm font-semibold">
                    {elegida ? "Otras opciones" : "Opciones"}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {opciones.map((o) => (
                      <li
                        key={o.plato.id}
                        className="border-borde bg-fondo flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold">
                            <span aria-hidden="true">{EMOJI_GRUPO[o.plato.grupo]} </span>
                            {o.plato.nombre}
                          </p>
                          <p className="text-tinta-suave text-sm">
                            {o.plato.minutosActivos} min · {NOMBRE_GRUPO[o.plato.grupo]}
                            {o.plato.valoracion !== null && (
                              <span
                                aria-label={`valoración media ${formatearNumero(o.plato.valoracion)} de 5`}
                              >
                                {" "}
                                · ★ {formatearNumero(o.plato.valoracion)}
                              </span>
                            )}
                          </p>
                          <Razones fecha={dia.fecha} opcion={o} />
                          {o.motivos.length > 0 && (
                            <ul className="mt-1 flex flex-wrap gap-1.5">
                              {o.motivos.map((m) => (
                                <li key={m} className="etiqueta bg-suave-1 text-tinta">
                                  {TEXTO_MOTIVO[m]}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button
                          type="button"
                          className="boton"
                          aria-label={`${elegida ? "Cambiar por" : "Elegir"} ${o.plato.nombre}`}
                          onClick={() =>
                            despachar({
                              tipo: "menu/elegir",
                              fecha: dia.fecha,
                              platoId: o.plato.id,
                            })
                          }
                        >
                          {elegida ? "Cambiar" : "Elegir"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
