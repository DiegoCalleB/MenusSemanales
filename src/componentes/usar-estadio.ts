"use client";

import { useEffect, useState } from "react";
import { type EventoEstadio } from "@/dominio/metropolitano";

/** Partidos y conciertos en el Metropolitano (D-159), pedidos al servidor. Vacío si fallan. */
export function useEstadio(): EventoEstadio[] {
  const [eventos, setEventos] = useState<EventoEstadio[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch("/api/metropolitano")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { eventos?: unknown } | null) => {
        if (!vivo || !j || !Array.isArray(j.eventos)) return;
        // Viene de nuestro servidor, pero se comprueba la forma: lo que no encaje no se pinta.
        setEventos(
          (j.eventos as EventoEstadio[]).filter(
            (e) =>
              typeof e?.id === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(e.fecha) &&
              typeof e.titulo === "string" &&
              ["partido", "concierto", "evento"].includes(e.tipo),
          ),
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return eventos;
}
