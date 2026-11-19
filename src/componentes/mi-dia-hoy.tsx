"use client";

import { Fragment, type FormEvent, useState } from "react";
import {
  type CeldaDeHistorial,
  MAX_HABITOS,
  MAX_NOMBRE_HABITO,
  cuidadoDe,
  diaDe,
  habitosPorBloque,
  historialDeHabitos,
  textoDeHabitos,
  resumenDelDia,
} from "@/dominio/cuidado";
import { sumarDias } from "@/dominio/fechas";
import { useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";
import { SeccionHoy } from "./seccion-hoy";
import { useYo } from "./yo";

const CELDA: Record<CeldaDeHistorial, string> = {
  hecho: "bg-marca",
  no: "bg-peligro-fondo",
  pendiente: "border-borde border",
  antes: "bg-suave-1 opacity-40",
};

/**
 * «Mi día» (D-186): la lista de cosas que quien tiene abierto el móvil quiere hacer cada día (leer,
 * subir escaleras, regar las plantas, limpiar el arenero…). Se marcan hoy, y se guarda el historial:
 * qué días se hizo cada una y qué días no, con la racha. Es personal y no sale de la app.
 */
export function MiDiaHoy() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const [dias, setDias] = useState<14 | 30>(14);
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  if (!yo) return null;

  const c = cuidadoDe(estado.cuidado, yo.id);
  const dia = diaDe(c, estado.hoy);
  const hoy = resumenDelDia(c, estado.hoy);
  const vacio = c.habitos.length === 0;

  return (
    <SeccionHoy id="sec-mi-dia" emoji="✅" titulo="Mi día" compacta={vacio} plegable>
      {!vacio && (
        <>
          <p role="status" className="text-base font-semibold">
            {hoy.hechos === hoy.total && hoy.total > 0
              ? "🎉 ¡Día completo!"
              : `${hoy.hechos} de ${hoy.total} hechas hoy`}
          </p>
          <ul aria-label="Mi lista de hoy" className="flex flex-col">
            {habitosPorBloque(c.habitos).map((g) => (
              <Fragment key={g.titulo || "sin-bloque"}>
                {g.titulo && (
                  <li className="text-tinta-suave pt-2 text-sm font-bold tracking-wide uppercase">
                    {g.titulo}
                  </li>
                )}
                {g.habitos.map((h) => {
                  const hecho = dia.habitos.includes(h.id);
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        aria-pressed={hecho}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-base ${hecho ? "text-tinta-suave line-through" : ""}`}
                        onClick={() =>
                          despachar({
                            tipo: "cuidado/habito",
                            personaId: yo.id,
                            fecha: estado.hoy,
                            id: h.id,
                          })
                        }
                      >
                        <span aria-hidden="true">{hecho ? "✅" : "⬜"}</span>
                        <span>{h.nombre}</span>
                      </button>
                    </li>
                  );
                })}
              </Fragment>
            ))}
          </ul>

          <details>
            <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
              ¿Se te olvidó marcar algo de ayer?
            </summary>
            <ul aria-label="Mi lista de ayer" className="flex flex-col pb-1">
              {c.habitos.map((h) => {
                const ayer = sumarDias(estado.hoy, -1);
                const hecho = diaDe(c, ayer).habitos.includes(h.id);
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      aria-pressed={hecho}
                      aria-label={`Ayer: ${h.nombre}`}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-base ${hecho ? "text-tinta-suave line-through" : ""}`}
                      onClick={() =>
                        despachar({
                          tipo: "cuidado/habito",
                          personaId: yo.id,
                          fecha: ayer,
                          id: h.id,
                        })
                      }
                    >
                      <span aria-hidden="true">{hecho ? "✅" : "⬜"}</span>
                      <span>{h.nombre}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>

          <details>
            <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
              Mi historial
            </summary>
            <Historial dias={dias} cambiar={setDias} />
          </details>
        </>
      )}

      <details>
        <summary
          className={
            vacio
              ? "boton w-fit cursor-pointer"
              : "text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold"
          }
        >
          {vacio ? "Apuntar lo que quiero hacer cada día" : "Cambiar mi lista"}
        </summary>
        <ListaDeCosas key={`${yo.id}-${c.habitos.map((h) => h.id).join(",")}`} personaId={yo.id} />
      </details>
    </SeccionHoy>
  );
}

function Historial({ dias, cambiar }: { dias: 14 | 30; cambiar: (d: 14 | 30) => void }) {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const c = cuidadoDe(estado.cuidado, yoId ?? "");
  const h = historialDeHabitos(c, estado.hoy, dias);
  const diasConTodo = h.porDia.filter((d) => d.total > 0 && d.hechos === d.total).length;
  const diasConLista = h.porDia.filter((d) => d.total > 0).length;

  return (
    <div className="flex flex-col gap-3 pb-1">
      <div role="group" aria-label="Periodo del historial" className="flex gap-2">
        {([14, 30] as const).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={dias === n}
            className={`${dias === n ? "boton" : "boton-suave"} min-w-11`}
            onClick={() => cambiar(n)}
          >
            {n} días
          </button>
        ))}
      </div>
      <p className="text-tinta-suave text-sm">
        Días con todo hecho: {diasConTodo} de {diasConLista}.
      </p>
      <ul aria-label="Historial por cosa" className="flex flex-col gap-3">
        {h.filas.map((f) => (
          <li key={f.habito.id} className="flex flex-col gap-1">
            <p className="text-base font-semibold">
              {f.habito.nombre}
              <span className="text-tinta-suave text-sm font-normal">
                {" "}
                · {f.hechos} de {f.aplicables} días
                {f.racha > 1 ? ` · ${f.racha} seguidos 🔥` : ""}
              </span>
            </p>
            <div aria-hidden="true" className="flex flex-wrap gap-1">
              {f.celdas.map((celda, i) => (
                <span
                  key={h.fechas[i]}
                  title={`${h.fechas[i]}: ${celda === "hecho" ? "hecho" : celda === "no" ? "no" : celda === "pendiente" ? "hoy, pendiente" : "aún no apuntado"}`}
                  className={`h-4 w-4 rounded ${CELDA[celda]}`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-tinta-suave text-sm">
        Cada cuadro es un día (el último, hoy): lleno = hecho, rojo = no se hizo, vacío = hoy aún
        por hacer.
      </p>
    </div>
  );
}

function ListaDeCosas({ personaId }: { personaId: string }) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const c = cuidadoDe(estado.cuidado, personaId);
  const [texto, setTexto] = useState(textoDeHabitos(c.habitos));
  const [aviso, setAviso] = useState(c.avisoDia === null ? "" : String(c.avisoDia));
  const [problema, setProblema] = useState("");
  const [guardado, setGuardado] = useState(false);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({
      tipo: "cuidado/ajustes",
      personaId,
      metaAgua: c.metaAgua,
      habitos: texto.split("\n"),
      ejercicio: c.ejercicio,
      avisos: c.avisos,
      avisoDia: aviso === "" ? null : Number(aviso),
    });
    setProblema(motivo ?? "");
    setGuardado(!motivo);
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Mi lista de cada día"
      className="flex flex-col gap-3 pb-1"
    >
      <label className="flex flex-col gap-1 text-base font-semibold">
        Lo que quiero hacer cada día (una por línea, hasta {MAX_HABITOS})
        <textarea
          className="campo"
          rows={5}
          maxLength={(MAX_NOMBRE_HABITO + 1) * (MAX_HABITOS + 6)}
          placeholder={"Mañana:\nSkincare\nMeditar 5 min\nNoche:\nLeer\nEscribir una línea del día"}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      <p className="text-tinta-suave -mt-2 text-sm">
        Si quitas una, se borra también su historial. Para agrupar, escribe una línea que acabe en
        «:» (por ejemplo «Mañana:») y pon debajo lo que va en ese bloque.
      </p>
      <label className="flex flex-col gap-1 text-base font-semibold">
        Avisarme en el móvil si me falta algo
        <select className="campo w-fit" value={aviso} onChange={(e) => setAviso(e.target.value)}>
          <option value="">No avisar</option>
          {[18, 19, 20, 21, 22, 23].map((h) => (
            <option key={h} value={h}>
              A las {h}:00
            </option>
          ))}
        </select>
      </label>
      <p className="text-tinta-suave -mt-2 text-sm">
        Solo dice cuántas te faltan, no cuáles. Hace falta tener activadas las notificaciones.
      </p>
      {problema && (
        <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          {problema}
        </p>
      )}
      {guardado && !problema && (
        <p role="status" className="text-tinta-suave text-sm">
          Guardado ✓
        </p>
      )}
      <button type="submit" className="boton w-fit">
        Guardar mi lista
      </button>
    </form>
  );
}
