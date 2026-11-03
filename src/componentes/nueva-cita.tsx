"use client";

import { type FormEvent, useId, useState } from "react";
import type { FechaIso } from "@/dominio/fechas";
import { useHogar } from "./proveedor-hogar";

/**
 * Apuntar una cita o evento: título, día y, si se quiere, hora y último día. Con `fecha` el día
 * viene fijado (se usa desde el calendario, al elegir un día); sin ella se elige (desde Hoy).
 */
export function NuevaCita({ fecha, alGuardar }: { fecha?: FechaIso; alGuardar?: () => void }) {
  const { estado, despachar } = useHogar();
  const id = useId();
  const [titulo, setTitulo] = useState("");
  const [dia, setDia] = useState<string>(estado.hoy);
  const [hora, setHora] = useState("");
  const [variosDias, setVariosDias] = useState(false);
  const [hasta, setHasta] = useState("");
  const dePartida = fecha ?? (dia as FechaIso);

  function enviar(e: FormEvent) {
    e.preventDefault();
    despachar({
      tipo: "agenda/cita",
      fecha: dePartida,
      titulo,
      hora: hora || null,
      hasta: variosDias && hasta ? (hasta as FechaIso) : null,
    });
    setTitulo("");
    setHora("");
    setHasta("");
    setVariosDias(false);
    alGuardar?.();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <label htmlFor={`${id}-t`} className="sr-only">
        Qué hay que apuntar
      </label>
      <input
        id={`${id}-t`}
        className="campo"
        value={titulo}
        maxLength={120}
        placeholder="Dentista de Alba, excursión…"
        onChange={(e) => setTitulo(e.target.value)}
      />
      <div className="flex flex-wrap items-end gap-2">
        {!fecha && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Día
            <input
              type="date"
              className="campo w-auto"
              value={dia}
              required
              onChange={(e) => setDia(e.target.value)}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Hora (opcional)
          <input
            type="time"
            className="campo w-auto"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-base">
          <input
            type="checkbox"
            className="size-5 accent-[var(--marca)]"
            checked={variosDias}
            onChange={(e) => setVariosDias(e.target.checked)}
          />
          Dura varios días
        </label>
      </div>
      {variosDias && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Último día
          <input
            type="date"
            className="campo w-auto"
            value={hasta}
            min={dePartida}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
      )}
      <button type="submit" className="boton w-fit" disabled={titulo.trim() === ""}>
        ＋ Apuntar
      </button>
    </form>
  );
}
