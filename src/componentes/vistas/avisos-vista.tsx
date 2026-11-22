"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import {
  type AvisosCfg,
  HORA_PRIMERA,
  HORA_ULTIMA,
  MAX_HORAS_DE_AGUA,
  horasPermitidas,
  limpiarCfg,
} from "@/dominio/avisos-personales";
import { cuidadoDe } from "@/dominio/cuidado";
import { NotificacionesMovil } from "../notificaciones-movil";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/**
 * Avisos (D-204): una sola pantalla para lo que te avisa el móvil y a qué hora. Interruptor y hora de
 * cada aviso; de 22:00 a 7:00 no se avisa de nada. Los avisos son personales: cada uno elige los suyos.
 */
export function AvisosVista() {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  const c = yo ? cuidadoDe(estado.cuidado, yo.id) : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Avisos <span aria-hidden="true">🔔</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Qué te avisa el móvil y a qué hora. De las 22:00 a las 7:00 no se avisa de nada.
        </p>
      </header>

      <NotificacionesMovil />

      {!yo || !c ? (
        <p className="tarjeta text-base">
          Elige quién eres (en «Familia») para ver y cambiar tus avisos.
        </p>
      ) : (
        <>
          <Mios key={yo.id} personaId={yo.id} avisos={c.avisos} cfg={limpiarCfg(c.avisosCfg)} />
          <section aria-labelledby="otros-avisos" className="tarjeta flex flex-col gap-2">
            <h2 id="otros-avisos" className="text-lg font-extrabold">
              Otros avisos
            </h2>
            <ul className="text-base">
              <li className="py-1">
                <span aria-hidden="true">✅ </span>
                <strong>Mi día:</strong>{" "}
                {c.avisoDia !== null ? `a las ${hh(c.avisoDia)} si te falta algo` : "sin aviso"}. Se
                cambia en «Hoy» → «Mi día».
              </li>
              <li className="py-1">
                <span aria-hidden="true">💊 </span>
                <strong>Medicación:</strong> a la hora de cada una.{" "}
                <Link
                  href="/medicacion"
                  className="text-marca-fuerte inline-flex min-h-11 items-center px-1 font-semibold underline"
                >
                  Cambiar
                </Link>
              </li>
              <li className="py-1">
                <span aria-hidden="true">🗓️ </span>
                <strong>Resumen de la familia:</strong> a las 9:00 el de hoy, a las 20:00 lo que
                dejar preparado para mañana y, un día de cole, a las 7:00 el paraguas. Son para toda
                la familia y se cambian en el servidor.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Mios({
  personaId,
  avisos: avisosInicial,
  cfg: cfgInicial,
}: {
  personaId: string;
  avisos: boolean;
  cfg: AvisosCfg;
}) {
  const { despachar } = useHogar();
  const [avisos, setAvisos] = useState(avisosInicial);
  const [cfg, setCfg] = useState<AvisosCfg>(cfgInicial);
  const [guardado, setGuardado] = useState(false);

  const cambiar = (c: AvisosCfg) => {
    setCfg(c);
    setGuardado(false);
  };
  const alternarHora = (h: number) => {
    const ya = cfg.agua.horas.includes(h);
    if (!ya && cfg.agua.horas.length >= MAX_HORAS_DE_AGUA) return;
    cambiar({
      ...cfg,
      agua: {
        ...cfg.agua,
        horas: ya
          ? cfg.agua.horas.filter((x) => x !== h)
          : [...cfg.agua.horas, h].sort((a, b) => a - b),
      },
    });
  };

  function guardar(e: FormEvent) {
    e.preventDefault();
    despachar({ tipo: "cuidado/avisos", personaId, avisos, cfg });
    setGuardado(true);
  }

  return (
    <form
      onSubmit={guardar}
      noValidate
      aria-label="Mis avisos"
      className="tarjeta flex flex-col gap-3"
    >
      <h2 className="text-lg font-extrabold">Mis avisos</h2>
      <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={avisos}
          onChange={(e) => {
            setAvisos(e.target.checked);
            setGuardado(false);
          }}
        />
        Avisos del móvil
      </label>

      <fieldset disabled={!avisos} className="flex flex-col gap-4 disabled:opacity-50">
        <legend className="sr-only">Qué avisos quiero</legend>

        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={cfg.agua.on}
              onChange={(e) => cambiar({ ...cfg, agua: { ...cfg.agua, on: e.target.checked } })}
            />
            <span>
              <span aria-hidden="true">💧 </span>Agua, solo si voy corto
            </span>
          </label>
          {cfg.agua.on && (
            <div
              role="group"
              aria-label="Horas del aviso del agua"
              className="flex flex-wrap gap-2"
            >
              {horasPermitidas().map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={cfg.agua.horas.includes(h)}
                  aria-label={`Agua a las ${hh(h)}`}
                  className={cfg.agua.horas.includes(h) ? "boton" : "boton-suave"}
                  onClick={() => alternarHora(h)}
                >
                  {hh(h)}
                </button>
              ))}
            </div>
          )}
          {cfg.agua.on && (
            <p className="text-tinta-suave text-sm">
              Hasta {MAX_HORAS_DE_AGUA} horas. A cada una, solo si llevas menos agua de la que toca.
            </p>
          )}
        </div>

        <FilaDeHora
          emoji="🏃"
          texto="Ejercicio, si hoy toca y no lo he hecho"
          nombre="ejercicio"
          on={cfg.ejercicio.on}
          hora={cfg.ejercicio.hora}
          alCambiar={(on, hora) => cambiar({ ...cfg, ejercicio: { on, hora } })}
        />
        <FilaDeHora
          emoji="🎯"
          texto="Objetivos que se repiten y ya tocan"
          nombre="objetivos"
          on={cfg.objetivos.on}
          hora={cfg.objetivos.hora}
          alCambiar={(on, hora) => cambiar({ ...cfg, objetivos: { on, hora } })}
        />
        <FilaDeHora
          emoji="🔎"
          texto="Revisión del domingo (ideas, objetivos parados)"
          nombre="revisión del domingo"
          on={cfg.revision.on}
          hora={cfg.revision.hora}
          alCambiar={(on, hora) => cambiar({ ...cfg, revision: { on, hora } })}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="boton w-fit">
          Guardar
        </button>
        {guardado && (
          <p role="status" className="text-tinta-suave text-sm">
            Guardado ✓
          </p>
        )}
      </div>
      <p className="text-tinta-suave text-sm">
        Las horas van de las {HORA_PRIMERA}:00 a las {HORA_ULTIMA}:00. El servidor solo sabe tus
        interruptores y horas, nunca qué hay en tus listas.
      </p>
    </form>
  );
}

function FilaDeHora({
  emoji,
  texto,
  nombre,
  on,
  hora,
  alCambiar,
}: {
  emoji: string;
  texto: string;
  nombre: string;
  on: boolean;
  hora: number;
  alCambiar: (on: boolean, hora: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={on}
          aria-label={`Aviso de ${nombre}`}
          onChange={(e) => alCambiar(e.target.checked, hora)}
        />
        <span>
          <span aria-hidden="true">{emoji} </span>
          {texto}
        </span>
      </label>
      {on && (
        <select
          className="campo w-28"
          aria-label={`Hora del aviso de ${nombre}`}
          value={hora}
          onChange={(e) => alCambiar(on, Number(e.target.value))}
        >
          {horasPermitidas().map((h) => (
            <option key={h} value={h}>
              {hh(h)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
