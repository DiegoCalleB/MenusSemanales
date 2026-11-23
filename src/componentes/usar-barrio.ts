"use client";

import { useEffect, useState } from "react";
import { useHogar } from "./proveedor-hogar";
import type { PlanBarrio } from "@/dominio/barrio";

/** Lo último que respondió el servidor y cuándo: se pregunta una vez por sesión y hora. */
let guardado: { en: number; planes: PlanBarrio[] } | null = null;
let pidiendo: Promise<PlanBarrio[]> | null = null;
const VALE_MS = 60 * 60 * 1000;

const validos = (v: unknown): PlanBarrio[] =>
  Array.isArray(v)
    ? (v as PlanBarrio[]).filter(
        (p) =>
          typeof p?.id === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) &&
          typeof p.titulo === "string" &&
          typeof p.emoji === "string",
      )
    : [];

function pedir(): Promise<PlanBarrio[]> {
  if (guardado && Date.now() - guardado.en < VALE_MS) return Promise.resolve(guardado.planes);
  pidiendo ??= fetch("/api/barrio")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { planes?: unknown } | null) => validos(j?.planes))
    .catch(() => [] as PlanBarrio[])
    .then((planes) => {
      guardado = { en: Date.now(), planes };
      pidiendo = null;
      return planes;
    });
  return pidiendo;
}

/** Los planes del barrio (San Blas-Canillejas, D-165), pedidos al servidor. Vacío si fallan. */
export function usePlanesDelBarrio(esperaMs = 0): PlanBarrio[] {
  const [planes, setPlanes] = useState<PlanBarrio[]>(guardado?.planes ?? []);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      void pedir().then((p) => vivo && setPlanes(p));
    }, esperaMs);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [esperaMs]);
  // Con el laboratorio apagado (D-206), como si no hubiera nada.
  const { estado } = useHogar();
  return estado.laboratorio ? planes : [];
}
