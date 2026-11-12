"use client";

import { useState } from "react";
import { parsearAgenda, resumenApunte } from "@/dominio/agenda";
import { BotonEditar, EditarCita } from "./editar";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

const fechaCorta = (f: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${f}T12:00:00Z`),
  );

/** Un apunte por línea, como en una nota del móvil. Con varias líneas pegadas pide confirmar antes. */
export function Apuntar() {
  const { estado, despachar } = useHogar();
  const [yo] = useYo();
  const [texto, setTexto] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const leido = parsearAgenda(texto, estado.hoy);
  const total = leido.conFecha.length + leido.sinFecha.length;
  const proximos = estado.agenda
    .filter((a) => (a.hasta ?? a.fecha) >= estado.hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, "es"));

  function apuntar() {
    despachar({ tipo: "agenda/anadir", texto, personaId: yo });
    setTexto("");
    setRevisando(false);
  }

  return (
    <section aria-labelledby="apuntar" className="tarjeta flex flex-col gap-3">
      <h2 id="apuntar" className="text-xl font-extrabold">
        ✍️ Apuntar
      </h2>
      <label htmlFor="apunte" className="text-tinta-suave text-base">
        Escribe como en una nota: «17 Marzo Excursión Alba», «1 Junio 8:00 Midas» o «17-19 Abril
        Puente». Lo que no lleva fecha pasa a tus tareas. También puedes pegar varias líneas.
      </label>
      <textarea
        id="apunte"
        className="campo min-h-24"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setRevisando(false);
        }}
        rows={3}
      />
      {revisando ? (
        <div className="bg-suave-1 flex flex-col gap-2 rounded-2xl p-3" role="status">
          <p className="text-base font-bold">
            Vas a apuntar {leido.conFecha.length} con fecha y {leido.sinFecha.length} sin fecha
            {leido.erroneos.length > 0 && `; ${leido.erroneos.length} no se entienden`}.
          </p>
          <p className="text-tinta-suave text-sm">
            Las fechas sin año se cuentan desde hoy ({fechaCorta(estado.hoy)}): si ya han pasado
            este año, se apuntan para el que viene.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton" onClick={apuntar}>
              Sí, apuntar todo
            </button>
            <button type="button" className="boton-suave" onClick={() => setRevisando(false)}>
              Revisar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="boton w-fit"
          disabled={texto.trim() === ""}
          onClick={() => (total > 3 ? setRevisando(true) : apuntar())}
        >
          Apuntar
        </button>
      )}

      {proximos.length > 0 && (
        <>
          <h3 className="text-base font-extrabold">Apuntado</h3>
          <ul aria-label="Apuntes" className="flex flex-col gap-2">
            {proximos.slice(0, 8).map((a) =>
              editando === a.id ? (
                <li key={a.id}>
                  <EditarCita cita={a} alCerrar={() => setEditando(null)} />
                </li>
              ) : (
                <li
                  key={a.id}
                  className="border-borde bg-fondo flex items-center justify-between gap-2 rounded-2xl border py-1.5 pr-1.5 pl-3"
                >
                  <p className="min-w-0 text-base">
                    <strong>{fechaCorta(a.fecha)}</strong> · {resumenApunte(a)}
                  </p>
                  <span className="flex shrink-0 gap-1">
                    <BotonEditar nombre={a.titulo} alPulsar={() => setEditando(a.id)} />
                    <button
                      type="button"
                      className="boton-icono"
                      aria-label={`Quitar ${a.titulo}`}
                      title="Quitar"
                      onClick={() => despachar({ tipo: "agenda/borrar", id: a.id })}
                    >
                      <span aria-hidden="true">🗑️</span>
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
          {proximos.length > 8 && (
            <p className="text-tinta-suave text-sm">Y {proximos.length - 8} más.</p>
          )}
        </>
      )}
    </section>
  );
}
