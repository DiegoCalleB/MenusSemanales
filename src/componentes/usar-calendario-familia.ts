"use client";

import { useEffect, useState } from "react";
import type { EventoExterno } from "@/dominio/ics";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import { useCuenta } from "./proveedor-hogar";

/**
 * Eventos del Google Calendar «Familia» (D-074). Solo se piden con la cuenta conectada: el servidor
 * guarda el enlace secreto y comprueba que quien pregunta es de la familia. Si falla o no está
 * configurado, devuelve una lista vacía y la app sigue igual.
 */
export function useCalendarioFamilia(hoy: string): EventoExterno[] {
  const { fase } = useCuenta();
  const [eventos, setEventos] = useState<EventoExterno[]>([]);

  useEffect(() => {
    if (fase !== "conectado") return;
    let vigente = true;
    void (async () => {
      try {
        const { data } = await crearClienteNavegador().auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const r = await fetch(`/api/calendario-familia?hoy=${hoy}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const cuerpo = (await r.json()) as { eventos?: EventoExterno[] };
        if (vigente && Array.isArray(cuerpo.eventos)) setEventos(cuerpo.eventos);
      } catch {
        // sin conexión o sin permiso: se queda sin eventos de Google
      }
    })();
    return () => {
      vigente = false;
    };
  }, [fase, hoy]);

  return eventos;
}
