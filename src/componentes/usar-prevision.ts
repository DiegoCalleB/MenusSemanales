"use client";

import { useEffect, useState } from "react";
import { type Pronostico, pronosticosDe } from "@/dominio/tiempo";
import { UN_DIA_MS, guardarCache, leerCache } from "./cache-local";

/**
 * La previsión del tiempo (D-145, D-148), pedida al servidor (no a Open-Meteo, para no abrir la
 * CSP). Sin conexión, se enseña lo último que se supo (hasta un día de edad, D-208); si no hay
 * nada, no se enseña nada del tiempo.
 */
const CLAVE = "tiempo";

const desdeCrudo = (j: { dias?: unknown }) =>
  pronosticosDe({ daily: aDaily(j.dias), hourly: aHourly(j.dias) });

export function usePrevision(): Pronostico[] {
  const [dias, setDias] = useState<Pronostico[]>([]);
  useEffect(() => {
    let vivo = true;
    // Primero lo último que se supo (si lo hay y no es viejo); luego, lo nuevo.
    const guardado = leerCache<{ dias?: unknown }>(CLAVE, UN_DIA_MS);
    if (guardado) {
      const d = desdeCrudo(guardado);
      // Después del primer pintado, para que servidor y navegador generen el mismo HTML.
      if (d.length > 0) void Promise.resolve().then(() => vivo && setDias(d));
    }
    fetch("/api/tiempo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { dias?: unknown } | null) => {
        // La respuesta viene del servidor, pero se vuelve a validar: lo que no encaje no se pinta.
        if (!vivo || !j) return;
        const d = desdeCrudo(j);
        if (d.length === 0) return;
        setDias(d);
        guardarCache(CLAVE, { dias: j.dias });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return dias;
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
