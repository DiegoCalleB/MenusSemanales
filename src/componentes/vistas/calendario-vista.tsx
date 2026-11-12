"use client";

import Link from "next/link";
import { esCumpleRepetido } from "@/dominio/cuenta-atras";
import { ComidaDelDia } from "../comida-del-dia";
import { BotonEditar, EditarCita } from "../editar";
import { NuevaCita } from "../nueva-cita";
import { useCalendarioFamilia } from "../usar-calendario-familia";
import { useMemo, useState } from "react";
import {
  MAX_PLATOS_POR_CENA,
  comidasDe,
  diaMenuDe,
  fechaApuntable,
  fechaPlanificable,
  nombreDia,
  opcionesParaFecha,
} from "@/aplicacion/estado";
import { fechaEnAnio } from "@/dominio/cumples";
import { diaSemanaIso, sumarDias, type FechaIso } from "@/dominio/fechas";
import { EMOJI_GRUPO } from "../formato";
import { TarjetaCole } from "../cole";
import { Razones } from "../razones";
import { NotaDelDia } from "../nota-del-dia";
import { PlatoRapido } from "../plato-rapido";
import { TodosLosPlatos } from "../todos-los-platos";
import { useHogar } from "../proveedor-hogar";

const MESES = [
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
const CABECERA = ["L", "M", "X", "J", "V", "S", "D"];
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const largo = (f: FechaIso) => {
  const [, m, d] = f.split("-").map(Number);
  return `${mayuscula(nombreDia(f))} ${d} de ${MESES[(m ?? 1) - 1]}`;
};

/** Cambia de mes sin salirse de rango: «2026-11-01» → «2026-12-01». */
function mesSiguiente(primero: FechaIso, delta: number): FechaIso {
  const [a, m] = primero.split("-").map(Number);
  const d = new Date(Date.UTC(a ?? 2026, (m ?? 1) - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Calendario del mes: de un vistazo, qué se cena cada día, qué comen las niñas en el cole y quién
 * cocina. Tocar un día abre su detalle para elegir o cambiar la cena, también semanas por delante.
 */
export function CalendarioVista() {
  const { estado, despachar } = useHogar();
  const deGoogle = useCalendarioFamilia(estado.hoy);
  const [mes, setMes] = useState<FechaIso>(`${estado.hoy.slice(0, 7)}-01`);
  const [sel, setSel] = useState<FechaIso>(estado.hoy);

  const [anio, nMes] = mes.split("-").map(Number);
  // Fechas señaladas y cumpleaños del año que se está viendo.
  const eventos: Record<string, { titulo: string; emoji: string }> = { ...estado.eventos };
  for (const c of estado.cumples) {
    for (const a of [(anio ?? 2026) - 1, anio ?? 2026, (anio ?? 2026) + 1]) {
      eventos[fechaEnAnio(a, c.mes, c.dia)] ??= { titulo: `Cumple de ${c.nombre}`, emoji: "🎂" };
    }
  }
  // Fechas señaladas y cumpleaños: el detalle del día los enseña aparte de las citas.
  const fijos = { ...eventos };
  // Lo apuntado a mano (D-075) y lo del Google Calendar «Familia», si está conectado (D-074).
  const apuntes = estado.agenda.map((a) => ({ fecha: a.fecha, titulo: a.titulo, hora: a.hora }));
  for (const ev of [...apuntes, ...deGoogle]) {
    if (esCumpleRepetido(ev.titulo, estado.cumples)) continue;
    const texto = ev.hora ? `${ev.titulo} (${ev.hora})` : ev.titulo;
    const ya = eventos[ev.fecha];
    eventos[ev.fecha] = ya
      ? { ...ya, titulo: `${ya.titulo} · ${texto}` }
      : { emoji: "📅", titulo: texto };
  }
  const diasEnMes = new Date(Date.UTC(anio ?? 2026, nMes ?? 1, 0)).getUTCDate();
  const huecos = diaSemanaIso(mes) - 1;
  const celdas: Array<FechaIso | null> = [
    ...Array.from({ length: huecos }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => sumarDias(mes, i)),
  ];

  const cenaDe = (f: FechaIso) => comidasDe(estado, f)[0];
  const nombresDe = (f: FechaIso) =>
    comidasDe(estado, f)
      .map((c) => c.plato.nombre)
      .join(" + ");
  const [anadiendoA, setAnadiendoA] = useState<FechaIso | null>(null);
  const [verTodosEn, setVerTodosEn] = useState<FechaIso | null>(null);
  const [editandoCita, setEditandoCita] = useState<string | null>(null);
  const [anadiendoCita, setAnadiendoCita] = useState<FechaIso | null>(null);
  const cocinaDe = (f: FechaIso) => {
    const turno = estado.turnos.find((t) => t.cargaId === "cenas" && t.fecha === f);
    return turno ? estado.personas.find((p) => p.id === turno.personaId)?.nombre : undefined;
  };

  const elegida = cenaDe(sel);
  const elegidas = comidasDe(estado, sel);
  const anadiendo = anadiendoA === sel;
  const cole = estado.colegio[sel] ?? null;
  const dia = diaMenuDe(estado, sel);
  const planificable = fechaPlanificable(estado, sel);
  const opciones = useMemo(
    () => (elegida && !anadiendo ? [] : opcionesParaFecha(estado, sel, anadiendo)),
    [estado, sel, elegida, anadiendo],
  );
  const citasDelDia = estado.agenda.filter((a) => a.fecha <= sel && (a.hasta ?? a.fecha) >= sel);
  const deGoogleDelDia = deGoogle.filter((g) => g.fecha === sel);
  const tarde = estado.llegoTarde.includes(sel);
  const cocina = cocinaDe(sel);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Calendario <span aria-hidden="true">📅</span>
        </h1>
      </header>

      <Link href="/fechas" className="boton-suave w-fit">
        📌 Próximas fechas y apuntar
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="tarjeta flex flex-col gap-3" aria-labelledby="mes">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="boton-suave"
              aria-label="Mes anterior"
              onClick={() => setMes(mesSiguiente(mes, -1))}
            >
              ‹
            </button>
            <h2 id="mes" className="text-xl font-extrabold">
              {mayuscula(MESES[(nMes ?? 1) - 1] ?? "")} {anio}
            </h2>
            <button
              type="button"
              className="boton-suave"
              aria-label="Mes siguiente"
              onClick={() => setMes(mesSiguiente(mes, 1))}
            >
              ›
            </button>
          </div>

          {/* En pantallas muy estrechas siete columnas no dejan 44 px por día: se muestra como lista. */}
          <ul className="flex flex-col gap-1 min-[400px]:hidden">
            {celdas.map((f) => {
              if (!f) return null;
              const cena = cenaDe(f);
              const esHoy = f === estado.hoy;
              const esSel = f === sel;
              return (
                <li key={f}>
                  <button
                    type="button"
                    aria-pressed={esSel}
                    onClick={() => setSel(f)}
                    className={`flex min-h-14 w-full flex-col justify-center rounded-2xl border px-4 py-1 text-left text-base ${
                      esSel
                        ? "bg-marca text-sobre-marca border-marca font-bold"
                        : esHoy
                          ? "border-marca bg-suave-1 font-bold"
                          : "border-borde bg-superficie"
                    }`}
                  >
                    <span>
                      {largo(f)}
                      {esHoy && " (hoy)"}
                      {estado.colegio[f] && <span> 🎒</span>}
                      {estado.almuerzos.some((a) => a.fecha === f) && <span> ☀️</span>}
                      {eventos[f] && <span> {eventos[f]?.emoji}</span>}
                    </span>
                    <span className="truncate text-sm font-normal">
                      {cena
                        ? `${EMOJI_GRUPO[(cena.plato as { grupo?: string }).grupo ?? "otro"] ?? "🍽️"} ${nombresDe(f)}`
                        : "Sin cena elegida"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden grid-cols-7 gap-1 text-center min-[400px]:grid">
            {CABECERA.map((c) => (
              <div key={c} aria-hidden="true" className="text-tinta-suave py-1 text-sm font-bold">
                {c}
              </div>
            ))}
            {celdas.map((f, i) => {
              if (!f) return <div key={`h${i}`} aria-hidden="true" />;
              const cena = cenaDe(f);
              const hayCole = estado.colegio[f] !== undefined;
              const evento = eventos[f];
              const esHoy = f === estado.hoy;
              const esSel = f === sel;
              const pasado = f < estado.hoy;
              const etiqueta = `${largo(f)}${cena ? `: cena ${nombresDe(f)}` : ": sin cena elegida"}${hayCole ? ", hay menú del cole" : ""}${evento ? `, ${evento.titulo}` : ""}${esHoy ? ", hoy" : ""}`;
              return (
                <div key={f}>
                  <button
                    type="button"
                    aria-label={etiqueta}
                    aria-pressed={esSel}
                    onClick={() => setSel(f)}
                    className={`flex min-h-16 w-full flex-col items-center justify-start gap-0.5 rounded-2xl border p-1 text-base ${
                      esSel
                        ? "bg-marca text-sobre-marca border-marca font-bold"
                        : esHoy
                          ? "border-marca bg-suave-1 font-bold"
                          : `border-borde bg-superficie hover:bg-suave-1 ${pasado ? "opacity-70" : ""}`
                    }`}
                  >
                    <span>{Number(f.slice(8))}</span>
                    <span aria-hidden="true" className="text-xl leading-none">
                      {cena
                        ? (EMOJI_GRUPO[(cena.plato as { grupo?: string }).grupo ?? "otro"] ?? "🍽️")
                        : ""}
                    </span>
                    {(hayCole || evento) && (
                      <span aria-hidden="true" className="text-xs leading-none">
                        {evento ? evento.emoji : ""}
                        {hayCole ? "🎒" : ""}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-tinta-suave text-sm">
            🎒 hay menú del cole · ☀️ hay comida apuntada · el emoji es el tipo de plato de la cena
            elegida
          </p>
        </section>

        <section className="tarjeta flex flex-col gap-4" aria-labelledby="detalle">
          <div>
            <h2 id="detalle" className="text-xl font-extrabold">
              {largo(sel)}
            </h2>
            {planificable && (
              <p className="text-tinta-suave text-base">
                Hasta {dia.minutosMax} min{cocina ? ` · cocina ${cocina}` : ""}
              </p>
            )}
          </div>

          {fijos[sel] && (
            <p className="bg-suave-1 rounded-2xl p-3 text-base font-bold">
              <span aria-hidden="true">{fijos[sel]?.emoji} </span>
              {fijos[sel]?.titulo}
            </p>
          )}

          <section aria-labelledby="citas-dia" className="flex flex-col gap-2">
            <h3 id="citas-dia" className="text-tinta-suave text-sm font-bold">
              Citas y eventos
            </h3>
            {citasDelDia.length === 0 && deGoogleDelDia.length === 0 && (
              <p className="text-tinta-suave text-base">Nada apuntado este día.</p>
            )}
            <ul className="flex flex-col">
              {citasDelDia.map((a) =>
                editandoCita === a.id ? (
                  <li key={a.id} className="py-2">
                    <EditarCita cita={a} alCerrar={() => setEditandoCita(null)} />
                  </li>
                ) : (
                  <li
                    key={a.id}
                    className="border-borde flex min-h-11 items-center justify-between gap-2 border-b last:border-b-0"
                  >
                    <span className="min-w-0 text-base">
                      <span aria-hidden="true">📌 </span>
                      {a.hora && <strong>{a.hora} </strong>}
                      {a.titulo}
                      {a.hasta && (
                        <span className="text-tinta-suave text-sm">
                          {" "}
                          · hasta el {a.hasta.slice(8)}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 gap-2">
                      <BotonEditar nombre={a.titulo} alPulsar={() => setEditandoCita(a.id)} />
                      <button
                        type="button"
                        className="boton-suave px-4"
                        aria-label={`Quitar la cita ${a.titulo}`}
                        onClick={() => despachar({ tipo: "agenda/borrar", id: a.id })}
                      >
                        Quitar
                      </button>
                    </span>
                  </li>
                ),
              )}
              {deGoogleDelDia.map((g, i) => (
                <li key={`g${i}`} className="min-h-11 py-2 text-base">
                  <span aria-hidden="true">📅 </span>
                  {g.hora && <strong>{g.hora} </strong>}
                  {g.titulo}
                  <span className="text-tinta-suave text-sm"> · de Google Calendar</span>
                </li>
              ))}
            </ul>
            {anadiendoCita === sel ? (
              <NuevaCita fecha={sel} alGuardar={() => setAnadiendoCita(null)} />
            ) : (
              <button
                type="button"
                className="boton-suave w-fit"
                onClick={() => setAnadiendoCita(sel)}
              >
                ＋ Cita o evento este día
              </button>
            )}
          </section>

          <TarjetaCole cole={cole} fecha={sel} />

          <ComidaDelDia fecha={sel} puedeApuntar={fechaApuntable(estado, sel)} />

          {elegida ? (
            <div className="flex flex-col gap-2">
              {elegidas.map((c) => (
                <div
                  key={c.plato.id}
                  className="bg-ok-fondo text-ok-texto flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
                >
                  <p className="text-base font-bold">
                    <span aria-hidden="true">✓ </span>
                    {c.plato.nombre}
                  </p>
                  {planificable && (
                    <button
                      type="button"
                      className="boton-suave"
                      aria-label={`Quitar ${c.plato.nombre}`}
                      onClick={() =>
                        despachar({ tipo: "menu/quitar", fecha: sel, platoId: c.plato.id })
                      }
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              {planificable && elegidas.length < MAX_PLATOS_POR_CENA && !anadiendo && (
                <button
                  type="button"
                  className="boton-suave w-fit"
                  onClick={() => setAnadiendoA(sel)}
                >
                  ＋ Añadir otro plato
                </button>
              )}
            </div>
          ) : (
            <p className="text-tinta-suave text-base">
              {planificable ? "Aún no hay cena elegida." : "Este día ya ha pasado."}
            </p>
          )}

          {planificable && (!elegida || anadiendo) && (
            <>
              <PlatoRapido
                anadir={anadiendo}
                alElegir={(platoId) => {
                  despachar({
                    tipo: anadiendo ? "menu/anadir" : "menu/elegir",
                    fecha: sel,
                    platoId,
                  });
                  setAnadiendoA(null);
                  setVerTodosEn(null);
                }}
              />
              <button
                type="button"
                className="boton-suave w-fit"
                aria-expanded={verTodosEn === sel}
                onClick={() => setVerTodosEn(verTodosEn === sel ? null : sel)}
              >
                📚 Ver todos los platos
              </button>
              {verTodosEn === sel && (
                <TodosLosPlatos
                  fecha={sel}
                  anadir={anadiendo}
                  alElegir={(platoId) => {
                    despachar({
                      tipo: anadiendo ? "menu/anadir" : "menu/elegir",
                      fecha: sel,
                      platoId,
                    });
                    setAnadiendoA(null);
                    setVerTodosEn(null);
                  }}
                />
              )}
            </>
          )}

          <NotaDelDia fecha={sel} />

          {planificable && (
            <button
              type="button"
              className={tarde ? "boton" : "boton-suave"}
              aria-pressed={tarde}
              onClick={() => despachar({ tipo: "menu/llegoTarde", fecha: sel })}
            >
              Ese día llego tarde
            </button>
          )}

          {planificable && opciones.length > 0 && (
            <div>
              <h3 className="text-tinta-suave mb-2 text-sm font-bold">
                {anadiendo ? "Añadir a la cena (platos pequeños primero)" : "Opciones"}
              </h3>
              <ul className="flex flex-col gap-2">
                {opciones.map((o) => (
                  <li
                    key={o.plato.id}
                    className="border-borde bg-fondo flex items-center justify-between gap-3 rounded-2xl border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-bold">
                        <span aria-hidden="true">{EMOJI_GRUPO[o.plato.grupo]} </span>
                        {o.plato.nombre}
                      </p>
                      <p className="text-tinta-suave text-sm">{o.plato.minutosActivos} min</p>
                      <Razones fecha={sel} opcion={o} />
                    </div>
                    <button
                      type="button"
                      className="boton"
                      aria-label={`${anadiendo ? "Añadir" : "Elegir"} ${o.plato.nombre} para el ${largo(sel)}`}
                      onClick={() => {
                        despachar({
                          tipo: anadiendo ? "menu/anadir" : "menu/elegir",
                          fecha: sel,
                          platoId: o.plato.id,
                        });
                        setAnadiendoA(null);
                      }}
                    >
                      {anadiendo ? "Añadir" : "Elegir"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
