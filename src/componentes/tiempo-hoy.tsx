"use client";

import { useEffect, useState } from "react";
import { lluviaDelCole } from "@/dominio/avisos";
import { type FechaIso, sumarDias } from "@/dominio/fechas";
import {
  LUGAR_TIEMPO,
  type Pronostico,
  consejosDelTiempo,
  pronosticosDe,
  resumenDelTiempo,
  textoDeLluviaDelCole,
} from "@/dominio/tiempo";
import { hayColeDe, tieneCole } from "@/aplicacion/cole";
import { useHogar } from "./proveedor-hogar";

/**
 * El tiempo en «Hoy» (D-145): hoy y mañana de un vistazo y, si hace falta, qué ponerse o llevar.
 * Los días de cole, si llueve en la ida o la vuelta, a qué horas (D-148). Sin conexión o si la
 * previsión no llega, no ocupa sitio.
 */
export function TiempoHoy() {
  const { estado } = useHogar();
  const [dias, setDias] = useState<Pronostico[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch("/api/tiempo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { dias?: unknown } | null) => {
        // La respuesta viene del servidor, pero se vuelve a validar: lo que no encaje no se pinta.
        if (vivo && j) setDias(pronosticosDe({ daily: aDaily(j.dias), hourly: aHourly(j.dias) }));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const hayCole = hayColeDe(estado);
  const deCole = (f: FechaIso) => tieneCole(estado) && hayCole(f);
  const hoy = dias.find((d) => d.fecha === estado.hoy);
  const manana = dias.find((d) => d.fecha === sumarDias(estado.hoy, 1));
  if (!hoy && !manana) return null;

  const fila = (cuando: string, p: Pronostico) => {
    const lluvia = deCole(p.fecha) ? lluviaDelCole(p) : [];
    const consejos = consejosDelTiempo(p).filter(
      (c) => !(lluvia.length > 0 && c.clave === "lluvia"),
    );
    return (
      <li className="flex flex-col">
        <p className="text-base">
          <strong>{cuando}</strong> {resumenDelTiempo(p)}
        </p>
        {lluvia.length > 0 && (
          <p className="text-base">
            <span aria-hidden="true">🌂 </span>
            {primeraMayuscula(textoDeLluviaDelCole(lluvia))}: <strong>paraguas</strong>
          </p>
        )}
        {consejos.map((c) => (
          <p key={c.clave} className="text-base">
            <span aria-hidden="true">{c.emoji} </span>
            {c.que}: <strong>{c.llevar}</strong>
          </p>
        ))}
      </li>
    );
  };

  return (
    <section aria-labelledby="tiempo-hoy" className="tarjeta flex flex-col gap-2">
      <h2 id="tiempo-hoy" className="text-lg font-bold">
        El tiempo en {LUGAR_TIEMPO.nombre}
      </h2>
      <ul className="flex flex-col gap-2">
        {hoy && fila("Hoy", hoy)}
        {manana && fila("Mañana", manana)}
      </ul>
    </section>
  );
}

/** De la lista de días del servidor al formato de Open-Meteo, para validarla con el mismo esquema. */
function aDaily(v: unknown) {
  const l = Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
  return {
    time: l.map((d) => d.fecha),
    weather_code: l.map((d) => d.codigo),
    temperature_2m_max: l.map((d) => d.max),
    temperature_2m_min: l.map((d) => d.min),
    precipitation_probability_max: l.map((d) => d.probLluvia),
    precipitation_sum: l.map((d) => d.lluviaMm),
  };
}

const primeraMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Las horas de cada día, de vuelta al formato de Open-Meteo (D-148). */
function aHourly(v: unknown) {
  const l = Array.isArray(v) ? (v as Array<{ fecha?: unknown; horas?: unknown }>) : [];
  const horas = l.flatMap((d) =>
    Array.isArray(d.horas)
      ? (d.horas as Array<Record<string, unknown>>).map((h): Record<string, unknown> => ({
          ...h,
          fecha: d.fecha,
        }))
      : [],
  );
  return {
    time: horas.map((h) =>
      typeof h.fecha === "string" && typeof h.hora === "number"
        ? `${h.fecha}T${String(h.hora).padStart(2, "0")}:00`
        : "",
    ),
    precipitation_probability: horas.map((h) => h.prob),
    precipitation: horas.map((h) => h.mm),
    weather_code: horas.map((h) => h.codigo),
  };
}
