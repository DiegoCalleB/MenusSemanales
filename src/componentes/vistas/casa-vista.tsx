"use client";

import { type FormEvent, useState } from "react";
import {
  FRECUENCIAS_CASA,
  PLANTILLA_GATOS,
  type TareaCasa,
  diasParaCasa,
  estadoDeCasa,
  ordenadasPorFecha,
  textoFrecuencia,
} from "@/dominio/casa";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

export function cuandoToca(dias: number): string {
  if (dias < -1) return `toca desde hace ${-dias} días`;
  if (dias === -1) return "tocaba ayer";
  if (dias === 0) return "toca hoy";
  if (dias === 1) return "toca mañana";
  return `toca en ${dias} días`;
}

const fechaCorta = (f: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${f}T12:00:00Z`),
  );

/**
 * Lo recurrente de la casa (D-078): sábanas, toallas, filtros… Cada tarea sabe cada cuánto toca y
 * a quién; al marcarla hecha se reprograma sola. Nadie tiene que acordarse de que toca.
 */
export function CasaVista() {
  const { estado, despachar } = useHogar();
  const [yo] = useYo();
  const personas = estado.personas.filter((p) => p.activa);
  const adultos = personas.filter((p) => p.tipo === "adulto");
  const [titulo, setTitulo] = useState("");
  const [cada, setCada] = useState(14);
  const [quien, setQuien] = useState("");
  const ordenadas = ordenadasPorFecha(estado.casa, estado.hoy);
  const grupos: Array<{ id: string; titulo: string; lista: TareaCasa[] }> = [
    {
      id: "hoy",
      titulo: "Hoy toca",
      lista: ordenadas.filter((t) => diasParaCasa(t, estado.hoy) <= 0),
    },
    {
      id: "semana",
      titulo: "Esta semana",
      lista: ordenadas.filter((t) => estadoDeCasa(t, estado.hoy) === "pronto"),
    },
    {
      id: "despues",
      titulo: "Más adelante",
      lista: ordenadas.filter((t) => estadoDeCasa(t, estado.hoy) === "lejos"),
    },
  ];
  const titulos = new Set(estado.casa.map((t) => t.titulo.toLowerCase()));
  const faltanGatos = PLANTILLA_GATOS.some((p) => !titulos.has(p.titulo.toLowerCase()));
  const sinResponsable = estado.casa.filter((t) => t.responsableId === null).length;

  function anadir(e: FormEvent) {
    e.preventDefault();
    despachar({ tipo: "casa/anadir", titulo, cadaDias: cada, responsableId: quien || null });
    setTitulo("");
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Casa <span aria-hidden="true">🏠</span>
        </h1>
      </header>
      <p className="text-tinta-suave text-base">
        Lo que se repite en casa. Cada cosa sabe cuándo toca y a quién; al marcarla hecha se
        reprograma sola, así que nadie tiene que acordarse.
      </p>

      {estado.casa.length === 0 && (
        <section aria-labelledby="empezar" className="tarjeta flex flex-col gap-3">
          <h2 id="empezar" className="text-xl font-extrabold">
            Empieza con lo de siempre
          </h2>
          <p className="text-base">
            Sábanas, toallas, nevera, filtros, cepillos, botiquín, caldera, coche, dentista… Son 12
            tareas con una frecuencia orientativa. Luego cambiáis las que no os valgan.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="boton"
              onClick={() => despachar({ tipo: "casa/plantilla" })}
            >
              Añadir la plantilla de la casa
            </button>
            <button
              type="button"
              className="boton-suave"
              onClick={() => despachar({ tipo: "casa/plantilla", conjunto: "gatos" })}
            >
              🐱 Añadir lo de los gatos
            </button>
          </div>
        </section>
      )}

      {sinResponsable > 0 && adultos.length > 0 && estado.casa.length > 0 && (
        <button
          type="button"
          className="boton-suave w-fit"
          onClick={() => despachar({ tipo: "casa/repartir" })}
        >
          🤝 Repartir las {sinResponsable} sin responsable entre los dos
        </button>
      )}

      {grupos
        .filter((g) => g.lista.length > 0)
        .map((g) => (
          <section key={g.id} aria-labelledby={`g-${g.id}`} className="flex flex-col gap-2">
            <h2 id={`g-${g.id}`} className="text-lg font-extrabold">
              {g.titulo}
            </h2>
            <ul aria-label={g.titulo} className="flex flex-col gap-2">
              {g.lista.map((t) => {
                const dias = diasParaCasa(t, estado.hoy);
                return (
                  <li
                    key={t.id}
                    className="tarjeta flex flex-col gap-3"
                    data-estado={estadoDeCasa(t, estado.hoy)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-base">
                        <span aria-hidden="true">{t.emoji} </span>
                        <strong>{t.titulo}</strong>
                        <span className="text-tinta-suave block text-sm">
                          {textoFrecuencia(t.cadaDias)} · {cuandoToca(dias)}
                          {t.ultimaVez ? ` · última vez ${fechaCorta(t.ultimaVez)}` : ""}
                        </span>
                      </p>
                      {t.responsableId && t.responsableId === yo && (
                        <span className="bg-suave-1 shrink-0 rounded-full px-3 py-0.5 text-sm font-bold">
                          Tuya
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {dias <= 0 && (
                        <>
                          <button
                            type="button"
                            className="boton"
                            aria-label={`Marcar hecha: ${t.titulo}`}
                            onClick={() => despachar({ tipo: "casa/hecha", id: t.id })}
                          >
                            ✓ Hecha
                          </button>
                          <button
                            type="button"
                            className="boton-suave"
                            aria-label={`Dejar para mañana: ${t.titulo}`}
                            onClick={() => despachar({ tipo: "casa/aplazar", id: t.id })}
                          >
                            Mañana
                          </button>
                        </>
                      )}
                      {dias > 0 && (
                        <button
                          type="button"
                          className="boton-suave"
                          aria-label={`Ya la hice: ${t.titulo}`}
                          onClick={() => despachar({ tipo: "casa/hecha", id: t.id })}
                        >
                          Ya la hice
                        </button>
                      )}
                      <label className="flex items-center gap-2 text-base">
                        <span className="sr-only">Responsable de {t.titulo}</span>
                        <select
                          className="campo w-auto"
                          value={t.responsableId ?? ""}
                          onChange={(e) =>
                            despachar({
                              tipo: "casa/asignar",
                              id: t.id,
                              responsableId: e.target.value || null,
                            })
                          }
                        >
                          <option value="">Los dos</option>
                          {personas.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      {t.compra && (
                        <button
                          type="button"
                          className="boton-suave"
                          aria-label={`A la lista de la compra: ${t.compra}`}
                          onClick={() => despachar({ tipo: "casa/aListaCompra", id: t.id })}
                        >
                          🛒 A la lista
                        </button>
                      )}
                      <button
                        type="button"
                        className="boton-suave"
                        aria-label={`Quitar ${t.titulo}`}
                        onClick={() => despachar({ tipo: "casa/borrar", id: t.id })}
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      <section aria-labelledby="nueva" className="tarjeta flex flex-col gap-3">
        <h2 id="nueva" className="text-lg font-extrabold">
          Añadir otra
        </h2>
        <form onSubmit={anadir} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-base font-semibold">
            Qué hay que hacer
            <input
              className="campo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={80}
              placeholder="Regar las plantas"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-base font-semibold">
              Cada cuánto
              <select
                className="campo"
                value={cada}
                onChange={(e) => setCada(Number(e.target.value))}
              >
                {FRECUENCIAS_CASA.map((f) => (
                  <option key={f.dias} value={f.dias}>
                    {f.texto}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-base font-semibold">
              A quién le toca
              <select className="campo" value={quien} onChange={(e) => setQuien(e.target.value)}>
                <option value="">Los dos</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="boton w-fit" disabled={titulo.trim() === ""}>
            Añadir
          </button>
        </form>
        {estado.casa.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="boton-suave"
              onClick={() => despachar({ tipo: "casa/plantilla" })}
            >
              Añadir lo que falte de la plantilla
            </button>
            {faltanGatos && (
              <button
                type="button"
                className="boton-suave"
                onClick={() => despachar({ tipo: "casa/plantilla", conjunto: "gatos" })}
              >
                🐱 Añadir lo de los gatos
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
