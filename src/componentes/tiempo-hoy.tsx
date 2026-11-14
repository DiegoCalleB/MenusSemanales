"use client";

import { useEffect, useState } from "react";
import { sumarDias } from "@/dominio/fechas";
import {
  LUGAR_TIEMPO,
  type Pronostico,
  consejosDelTiempo,
  pronosticosDe,
  resumenDelTiempo,
} from "@/dominio/tiempo";
import { useHogar } from "./proveedor-hogar";

/**
 * El tiempo en «Hoy» (D-145): hoy y mañana de un vistazo y, si hace falta, qué ponerse o llevar.
 * Sin conexión o si la previsión no llega, no ocupa sitio.
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
        if (vivo && j) setDias(pronosticosDe({ daily: aDaily(j.dias) }));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const hoy = dias.find((d) => d.fecha === estado.hoy);
  const manana = dias.find((d) => d.fecha === sumarDias(estado.hoy, 1));
  if (!hoy && !manana) return null;

  const fila = (cuando: string, p: Pronostico) => {
    const consejos = consejosDelTiempo(p);
    return (
      <li className="flex flex-col">
        <p className="text-base">
          <strong>{cuando}</strong> {resumenDelTiempo(p)}
        </p>
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
