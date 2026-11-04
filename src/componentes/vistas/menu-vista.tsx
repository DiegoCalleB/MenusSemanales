"use client";

import { useMemo, useState } from "react";
import {
  MAX_PLATOS_POR_CENA,
  comidasDe,
  diasDelMenu,
  fechaPlanificable,
  menuDeLaSemana,
  nombreDia,
  opcionesParaFecha,
} from "@/aplicacion/estado";
import type { Opcion } from "@/dominio/menu";
import { planParaCompartir } from "@/aplicacion/compartir";
import { almuerzosDe } from "@/dominio/almuerzos";
import { textoMenu } from "@/dominio/compartir";
import { BotonesCompartir } from "../compartir-botones";
import { TarjetaCole } from "../cole";
import { ComidaDelDia } from "../comida-del-dia";
import { EMOJI_GRUPO, formatearNumero } from "../formato";
import { useHogar } from "../proveedor-hogar";
import { useFormatoMenu } from "../usar-formato-menu";
import { Razones } from "../razones";
import { NotaDelDia } from "../nota-del-dia";
import { PlatoRapido } from "../plato-rapido";
import { TodosLosPlatos } from "../todos-los-platos";

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const largo = (f: string) => {
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${mayuscula(nombreDia(f))} ${Number(f.slice(8))} de ${meses[Number(f.slice(5, 7)) - 1]}`;
};

function Valoracion({ platoId, nombre }: { platoId: string; nombre: string }) {
  const { estado, despachar } = useHogar();
  const notas = estado.valoraciones[platoId] ?? {};
  return (
    <details className="border-borde rounded-2xl border px-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-base font-bold">
        ¿Qué tal estuvo? {nombre}
      </summary>
      <ul className="flex flex-col gap-2 pb-2">
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
    </details>
  );
}

export function MenuVista() {
  const { estado, despachar } = useHogar();
  const dias = useMemo(() => diasDelMenu(estado), [estado]);
  const propuesta = useMemo(() => menuDeLaSemana(estado), [estado]);
  const plan = useMemo(() => planParaCompartir(estado), [estado]);
  const [formatoMenu] = useFormatoMenu();
  const eleccion = (fecha: string) => comidasDe(estado, fecha)[0];
  const [anadiendo, setAnadiendo] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState<string | null>(null);
  // Solo un día abierto a la vez: por defecto, el primero que aún no tiene cena.
  const primeraSinCena = dias.find(
    (d) => !estado.saltados.includes(d.fecha) && !eleccion(d.fecha),
  )?.fecha;
  const [abierto, setAbierto] = useState<string | null | undefined>(undefined);
  const abiertoAhora = abierto === undefined ? (primeraSinCena ?? null) : abierto;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Menú</h1>
        <div role="group" aria-label="Cuánto planificar" className="flex gap-2">
          {(
            [
              ["semana", "Semana"],
              ["quincena", "15 días"],
              ["mes", "Un mes"],
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
      </header>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="boton w-full sm:w-fit"
          onClick={() => despachar({ tipo: "menu/autocompletar" })}
        >
          ✨ Proponer días sin cena
        </button>
        <details className="border-borde rounded-2xl border px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-bold">
            Compartir el menú
          </summary>
          <div className="pb-3">
            <BotonesCompartir
              titulo={plan.titulo}
              texto={textoMenu(plan.titulo, plan.dias, formatoMenu)}
            />
          </div>
        </details>
      </div>

      <ul className="flex flex-col gap-2">
        {dias.map((dia) => {
          const elegida = eleccion(dia.fecha);
          const elegidas = comidasDe(estado, dia.fecha);
          const opciones: Opcion[] = elegida
            ? []
            : (propuesta.dias.find((d) => d.fecha === dia.fecha)?.opciones ?? []);
          const opcionElegida = propuesta.dias.find((d) => d.fecha === dia.fecha)?.opciones[0];
          const tarde = estado.llegoTarde.includes(dia.fecha);
          const evento = estado.eventos[dia.fecha];
          const saltado = estado.saltados.includes(dia.fecha);
          const abiertoDia = abiertoAhora === dia.fecha && !saltado;
          const emojisCole = [dia.cole?.primero, dia.cole?.segundo]
            .filter((g): g is NonNullable<typeof g> => !!g)
            .map((g) => EMOJI_GRUPO[g])
            .join(" ");
          const grupoElegida = (elegida?.plato as { grupo?: string } | undefined)?.grupo ?? "otro";

          if (saltado) {
            return (
              <li
                key={dia.fecha}
                className="tarjeta flex items-center justify-between gap-3 py-2 opacity-80"
              >
                <h2 className="text-base font-bold">
                  {largo(dia.fecha)}{" "}
                  <span className="text-tinta-suave font-normal">· sin cena en casa</span>
                </h2>
                <button
                  type="button"
                  className="boton-suave shrink-0 whitespace-nowrap"
                  onClick={() => despachar({ tipo: "menu/saltar", fecha: dia.fecha })}
                >
                  Planificar
                </button>
              </li>
            );
          }

          return (
            <li key={dia.fecha} className="tarjeta p-0">
              <h2>
                <button
                  type="button"
                  aria-expanded={abiertoDia}
                  onClick={() => setAbierto(abiertoDia ? null : dia.fecha)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                >
                  <span className="w-14 shrink-0 leading-tight">
                    <span className="sr-only">{largo(dia.fecha)}</span>
                    <span aria-hidden="true" className="block text-sm font-semibold uppercase">
                      {nombreDia(dia.fecha).slice(0, 3)}
                    </span>
                    <span aria-hidden="true" className="block text-2xl font-extrabold">
                      {Number(dia.fecha.slice(8))}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold">
                      {elegida ? (
                        <>
                          <span aria-hidden="true">{EMOJI_GRUPO[grupoElegida]} </span>
                          {comidasDe(estado, dia.fecha)
                            .map((c) => c.plato.nombre)
                            .join(" + ")}
                        </>
                      ) : (
                        <span className="text-marca-fuerte">Elegir cena</span>
                      )}
                    </span>
                    <span className="text-tinta-suave block truncate text-sm">
                      {evento && <span aria-hidden="true">{evento.emoji} </span>}
                      {evento ? `${evento.titulo} · ` : ""}
                      {almuerzosDe(estado.almuerzos, dia.fecha).length > 0 && (
                        <>
                          <span aria-hidden="true">☀️ </span>
                          <span className="sr-only">comida: </span>
                          {almuerzosDe(estado.almuerzos, dia.fecha)
                            .map((a) => a.texto)
                            .join(" + ")}
                          {" · "}
                        </>
                      )}
                      {emojisCole ? (
                        <>
                          <span aria-hidden="true">🎒 {emojisCole}</span>
                          <span className="sr-only"> cole: {emojisCole}</span>
                        </>
                      ) : (
                        "sin cole"
                      )}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-xl">
                    {abiertoDia ? "▴" : "▾"}
                  </span>
                </button>
              </h2>

              {abiertoDia && (
                <div className="flex flex-col gap-3 px-4 pb-4">
                  <TarjetaCole cole={dia.cole} fecha={dia.fecha} />

                  <h3 className="text-base font-extrabold">
                    <span aria-hidden="true">🍴 </span>Cena
                  </h3>

                  {elegidas.map((c) => (
                    <div
                      key={c.plato.id}
                      className="bg-ok-fondo text-ok-texto flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
                    >
                      <p className="text-base font-bold">
                        <span aria-hidden="true">✓ </span>
                        {c.plato.nombre}
                      </p>
                      <button
                        type="button"
                        className="boton-suave"
                        aria-label={`Quitar ${c.plato.nombre}`}
                        onClick={() =>
                          despachar({ tipo: "menu/quitar", fecha: dia.fecha, platoId: c.plato.id })
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  {elegida && elegidas.length < MAX_PLATOS_POR_CENA && anadiendo !== dia.fecha && (
                    <button
                      type="button"
                      className="boton-suave w-fit"
                      onClick={() => setAnadiendo(dia.fecha)}
                    >
                      ＋ Añadir otro plato
                    </button>
                  )}
                  {elegida && opcionElegida && <Razones fecha={dia.fecha} opcion={opcionElegida} />}
                  {dia.fecha <= estado.hoy &&
                    elegidas.map((c) => (
                      <Valoracion key={c.plato.id} platoId={c.plato.id} nombre={c.plato.nombre} />
                    ))}

                  {anadiendo === dia.fecha && (
                    <div className="flex flex-col gap-2">
                      <p className="text-base font-bold">
                        Añadir a la cena (platos pequeños primero)
                      </p>
                      <ul aria-label="Platos para añadir" className="flex flex-col gap-2">
                        {opcionesParaFecha(estado, dia.fecha, true).map((o) => (
                          <li
                            key={o.plato.id}
                            className="border-borde bg-fondo flex items-center justify-between gap-3 rounded-2xl border p-3"
                          >
                            <div className="min-w-0">
                              <p className="text-base font-bold">
                                <span aria-hidden="true">{EMOJI_GRUPO[o.plato.grupo]} </span>
                                {o.plato.nombre}
                              </p>
                              <p className="text-tinta-suave text-sm">
                                {o.plato.minutosActivos} min
                              </p>
                            </div>
                            <button
                              type="button"
                              className="boton"
                              aria-label={`Añadir ${o.plato.nombre}`}
                              onClick={() => {
                                despachar({
                                  tipo: "menu/anadir",
                                  fecha: dia.fecha,
                                  platoId: o.plato.id,
                                });
                                // Sigue la lista abierta hasta llenar la cena o pulsar «Listo».
                                if (elegidas.length + 1 >= MAX_PLATOS_POR_CENA) setAnadiendo(null);
                              }}
                            >
                              Añadir
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="boton-suave w-fit"
                        onClick={() => setAnadiendo(null)}
                      >
                        Listo
                      </button>
                    </div>
                  )}

                  {!elegida && opciones.length === 0 && (
                    <p className="text-tinta-suave text-base">
                      Ningún plato cumple las reglas de este día (tiempo, cole o ingredientes).
                    </p>
                  )}

                  {!elegida && opciones.length > 0 && (
                    <ul
                      aria-label={`Opciones para el ${nombreDia(dia.fecha)}`}
                      className="flex flex-col gap-2"
                    >
                      {opciones.map((o) => (
                        <li
                          key={o.plato.id}
                          className="border-borde bg-fondo flex flex-col gap-1 rounded-2xl border p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-base font-bold">
                                <span aria-hidden="true">{EMOJI_GRUPO[o.plato.grupo]} </span>
                                {o.plato.nombre}
                              </p>
                              <p className="text-tinta-suave text-sm">
                                {o.plato.minutosActivos} min
                                {o.plato.valoracion !== null &&
                                  ` · ★ ${formatearNumero(o.plato.valoracion)}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="boton"
                              aria-label={`Elegir ${o.plato.nombre}`}
                              onClick={() => {
                                despachar({
                                  tipo: "menu/elegir",
                                  fecha: dia.fecha,
                                  platoId: o.plato.id,
                                });
                                // El día elegido se queda abierto y las demás opciones siguen a la vista,
                                // para marcar varios platos seguidos sin volver a buscarlos.
                                setAbierto(dia.fecha);
                                setAnadiendo(dia.fecha);
                              }}
                            >
                              Elegir
                            </button>
                          </div>
                          <Razones fecha={dia.fecha} opcion={o} />
                        </li>
                      ))}
                    </ul>
                  )}

                  {(!elegida || anadiendo === dia.fecha) && (
                    <>
                      <PlatoRapido
                        anadir={anadiendo === dia.fecha}
                        alElegir={(platoId) => {
                          despachar({
                            tipo: anadiendo === dia.fecha ? "menu/anadir" : "menu/elegir",
                            fecha: dia.fecha,
                            platoId,
                          });
                          if (
                            !(anadiendo === dia.fecha || elegida) ||
                            elegidas.length + 1 >= MAX_PLATOS_POR_CENA
                          ) {
                            setAnadiendo(null);
                            setVerTodos(null);
                          }
                          setAbierto(dia.fecha);
                        }}
                      />
                      <button
                        type="button"
                        className="boton-suave w-fit"
                        aria-expanded={verTodos === dia.fecha}
                        onClick={() => setVerTodos(verTodos === dia.fecha ? null : dia.fecha)}
                      >
                        📚 Ver todos los platos
                      </button>
                      {verTodos === dia.fecha && (
                        <TodosLosPlatos
                          fecha={dia.fecha}
                          anadir={anadiendo === dia.fecha}
                          alElegir={(platoId) => {
                            despachar({
                              tipo: anadiendo === dia.fecha ? "menu/anadir" : "menu/elegir",
                              fecha: dia.fecha,
                              platoId,
                            });
                            // Mientras quepan más platos, la lista sigue abierta.
                            if (
                              !(anadiendo === dia.fecha || elegida) ||
                              elegidas.length + 1 >= MAX_PLATOS_POR_CENA
                            ) {
                              setAnadiendo(null);
                              setVerTodos(null);
                            }
                            setAbierto(dia.fecha);
                          }}
                        />
                      )}
                    </>
                  )}

                  <details className="border-borde rounded-2xl border px-3">
                    <summary className="flex min-h-11 cursor-pointer items-center text-base font-bold">
                      <span aria-hidden="true">☀️ </span>&nbsp;Comida, nota y más opciones
                    </summary>
                    <div className="flex flex-col gap-3 pb-3">
                      <ComidaDelDia
                        fecha={dia.fecha}
                        puedeApuntar={fechaPlanificable(estado, dia.fecha)}
                      />
                      <NotaDelDia fecha={dia.fecha} />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={tarde}
                          onClick={() => despachar({ tipo: "menu/llegoTarde", fecha: dia.fecha })}
                          className={tarde ? "boton" : "boton-suave"}
                        >
                          Llego tarde (15 min)
                        </button>
                        <button
                          type="button"
                          className="boton-suave"
                          onClick={() => despachar({ tipo: "menu/saltar", fecha: dia.fecha })}
                        >
                          No cenamos en casa
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
