"use client";

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { estadoInicialDemo } from "@/aplicacion/datos-demo";
import { type Accion, type EstadoHogar, reducir } from "@/aplicacion/estado";

interface ContextoHogar {
  estado: EstadoHogar;
  despachar: Dispatch<Accion>;
}

const Contexto = createContext<ContextoHogar | null>(null);

/**
 * Mantiene el estado del hogar mientras se navega entre pantallas. Ahora parte de datos de
 * demostración; el adaptador de Supabase lo sustituirá sin tocar las vistas.
 */
export function ProveedorHogar({ children }: { children: ReactNode }) {
  const [estado, despachar] = useReducer(reducir, undefined, estadoInicialDemo);
  return <Contexto.Provider value={{ estado, despachar }}>{children}</Contexto.Provider>;
}

export function useHogar(): ContextoHogar {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useHogar debe usarse dentro de <ProveedorHogar>");
  return contexto;
}
