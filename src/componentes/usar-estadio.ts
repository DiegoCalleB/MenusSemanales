"use client";

import { useEffect, useState } from "react";
import { type EventoEstadio } from "@/dominio/metropolitano";

/** Lo último que respondió el servidor y cuándo: se pregunta una vez por sesión y hora. */
let guardado: { en: number; eventos: EventoEstadio[] } | null = null;
let pidiendo: Promise<EventoEstadio[]> | null = null;
const VALE_MS = 60 * 60 * 1000;

const validos = (v: unknown): EventoEstadio[] =>
  Array.isArray(v)
    ? (v as EventoEstadio[]).filter(
        (e) =>
          typeof e?.id === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(e.fecha) &&
          typeof e.titulo === "string" &&
          ["partido", "concierto", "evento"].includes(e.tipo),
      )
    : [];

function pedir(): Promise<EventoEstadio[]> {
  if (guardado && Date.now() - guardado.en < VALE_MS) return Promise.resolve(guardado.eventos);
  pidiendo ??= fetch("/api/metropolitano")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { eventos?: unknown } | null) => validos(j?.eventos))
    .catch(() => [] as EventoEstadio[])
    .then((eventos) => {
      guardado = { en: Date.now(), eventos };
      pidiendo = null;
      return eventos;
    });
  return pidiendo;
}

/**
 * Partidos y conciertos en el Metropolitano (D-159), pedidos al servidor. Vacío si fallan.
 * `esperaMs`: cuánto esperar antes de preguntar. La campanita, que está en todas las pantallas, no
 * debe retrasar la carga de ninguna (D-163): espera unos segundos.
 */
export function useEstadio(esperaMs = 0): EventoEstadio[] {
  const [eventos, setEventos] = useState<EventoEstadio[]>(guardado?.eventos ?? []);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      void pedir().then((e) => vivo && setEventos(e));
    }, esperaMs);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [esperaMs]);
  return eventos;
}
