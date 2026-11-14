"use client";

import { useState } from "react";
import {
  type CosaQueLlevar,
  MAX_ANTES,
  NOMBRE_DIA_CORTO,
  cuandoSeLleva,
  cuandoSePrepara,
} from "@/dominio/mochila";
import { CalendarioCole } from "../calendario-cole";
import { BotonEditar, Campo, Formulario, useGuardar } from "../editar";
import { MochilaHoy } from "../mochila-hoy";
import { useHogar } from "../proveedor-hogar";

/**
 * Qué llevar (D-136): la carpeta de piano de los martes, los patines de los viernes… Se apunta una
 * vez y la app avisa el día que hay que dejarlo preparado (en «Hoy», en el aviso del móvil y en el
 * calendario suscrito).
 */
export function MochilaVista() {
  const { estado, despachar } = useHogar();
  const [anadiendo, setAnadiendo] = useState(estado.mochila.length === 0);
  const [editando, setEditando] = useState<string | null>(null);
  // Primero los niños, que son los que llevan cosas.
  const personas = estado.personas
    .filter((p) => p.activa)
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "nino" ? -1 : 1));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Qué llevar <span aria-hidden="true">🎒</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Lo que hay que llevar al cole o a una actividad. Te aviso el día que toca dejarlo
          preparado.
        </p>
      </header>

      <MochilaHoy siempre />

      <section aria-labelledby="mochila-lista" className="tarjeta flex flex-col gap-3">
        <h2 id="mochila-lista" className="text-lg font-bold">
          Apuntado
        </h2>
        {estado.mochila.length === 0 && (
          <p className="text-tinta-suave text-base">
            Aún no hay nada. Por ejemplo: «Carpeta de piano», los martes, preparada la víspera.
          </p>
        )}
        {personas.map((p) => {
          const suyas = estado.mochila.filter((c) => c.personaId === p.id);
          if (suyas.length === 0) return null;
          return (
            <div key={p.id} className="flex flex-col gap-2">
              <h3 className="text-base font-extrabold">{p.nombre}</h3>
              <ul aria-label={`Qué lleva ${p.nombre}`} className="flex flex-col gap-2">
                {suyas.map((c) =>
                  editando === c.id ? (
                    <li key={c.id}>
                      <FormularioCosa cosa={c} alCerrar={() => setEditando(null)} />
                    </li>
                  ) : (
                    <li
                      key={c.id}
                      className="border-borde bg-fondo flex items-center justify-between gap-2 rounded-2xl border py-1.5 pr-1.5 pl-3"
                    >
                      <p className="min-w-0 text-base">
                        <strong>{c.texto}</strong>
                        <span className="text-tinta-suave block text-sm">
                          {cuandoSeLleva(c)} · se prepara {cuandoSePrepara(c.antes)}
                          {!c.fecha && (c.soloConCole ? " · solo con cole" : " · también sin cole")}
                        </span>
                      </p>
                      <span className="flex shrink-0 gap-1">
                        <BotonEditar nombre={c.texto} alPulsar={() => setEditando(c.id)} />
                        <button
                          type="button"
                          className="boton-icono"
                          aria-label={`Quitar ${c.texto} de ${p.nombre}`}
                          title="Quitar"
                          onClick={() => despachar({ tipo: "mochila/borrar", id: c.id })}
                        >
                          <span aria-hidden="true">🗑️</span>
                        </button>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          );
        })}
        {anadiendo ? (
          <FormularioCosa alCerrar={() => setAnadiendo(false)} />
        ) : (
          <button type="button" className="boton w-fit" onClick={() => setAnadiendo(true)}>
            ＋ Apuntar algo que llevar
          </button>
        )}
      </section>

      <CalendarioCole />
    </div>
  );
}

/** Añadir (sin `cosa`) o editar lo que hay que llevar. */
function FormularioCosa({ cosa, alCerrar }: { cosa?: CosaQueLlevar; alCerrar: () => void }) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const personas = estado.personas.filter((p) => p.activa);
  const ninos = personas.filter((p) => p.tipo === "nino");
  const [personaId, setPersonaId] = useState(
    cosa?.personaId ?? ninos[0]?.id ?? personas[0]?.id ?? "",
  );
  const [texto, setTexto] = useState(cosa?.texto ?? "");
  const [suelto, setSuelto] = useState(Boolean(cosa?.fecha));
  const [dias, setDias] = useState<number[]>(cosa?.dias ?? []);
  const [fecha, setFecha] = useState(cosa?.fecha ?? "");
  const [antes, setAntes] = useState(cosa?.antes ?? 1);
  const [soloConCole, setSoloConCole] = useState(cosa?.soloConCole ?? true);

  const alternarDia = (d: number) =>
    setDias((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]));

  return (
    <Formulario
      nombre={cosa ? `Editar ${cosa.texto}` : "Apuntar algo que llevar"}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({
          ...(cosa
            ? { tipo: "mochila/editar" as const, id: cosa.id }
            : { tipo: "mochila/anadir" as const }),
          personaId,
          texto,
          dias: suelto ? [] : dias,
          fecha: suelto ? fecha : null,
          antes,
          soloConCole,
        })
      }
    >
      <Campo texto="Qué">
        <input
          className="campo"
          value={texto}
          maxLength={120}
          placeholder="Carpeta de piano, patines…"
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">Quién</legend>
        <div className="flex flex-wrap gap-2">
          {personas.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === personaId ? "boton" : "boton-suave"}
              aria-pressed={p.id === personaId}
              onClick={() => setPersonaId(p.id)}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">Cuándo se lleva</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={!suelto ? "boton" : "boton-suave"}
            aria-pressed={!suelto}
            onClick={() => setSuelto(false)}
          >
            Cada semana
          </button>
          <button
            type="button"
            className={suelto ? "boton" : "boton-suave"}
            aria-pressed={suelto}
            onClick={() => setSuelto(true)}
          >
            Un día concreto
          </button>
        </div>
        {suelto ? (
          <label className="mt-1 flex flex-col gap-1 text-base font-semibold">
            Día
            <input
              className="campo"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
        ) : (
          <div role="group" aria-label="Días de la semana" className="mt-1 flex flex-wrap gap-1">
            {NOMBRE_DIA_CORTO.map((n, i) => (
              <button
                key={n}
                type="button"
                className={dias.includes(i + 1) ? "boton px-3" : "boton-suave px-3"}
                aria-pressed={dias.includes(i + 1)}
                onClick={() => alternarDia(i + 1)}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        {!suelto && (
          <label className="mt-1 flex min-h-11 items-center gap-3 text-base">
            <input
              type="checkbox"
              className="size-6 shrink-0 accent-[var(--marca)]"
              checked={soloConCole}
              onChange={(e) => setSoloConCole(e.target.checked)}
            />
            <span>
              Es para el cole
              <span className="text-tinta-suave block text-sm">
                No se avisa en festivos ni vacaciones
              </span>
            </span>
          </label>
        )}
      </fieldset>
      <Campo texto="Dejarlo preparado">
        <select className="campo" value={antes} onChange={(e) => setAntes(Number(e.target.value))}>
          {Array.from({ length: MAX_ANTES + 1 }, (_, i) => (
            <option key={i} value={i}>
              {cuandoSePrepara(i)}
            </option>
          ))}
        </select>
      </Campo>
    </Formulario>
  );
}
