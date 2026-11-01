"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import type { AlmacenHogar } from "@/aplicacion/almacen";
import { estadoInicialDemo } from "@/aplicacion/datos-demo";
import { type Accion, type EstadoHogar, reducir } from "@/aplicacion/estado";
import { crearAlmacenLocal } from "@/infraestructura/almacen-local";

interface ContextoHogar {
  estado: EstadoHogar;
  despachar: Dispatch<Accion>;
  /** Modo prueba: vuelve a los datos de ejemplo y olvida lo guardado. */
  restablecer: () => void;
}

const Contexto = createContext<ContextoHogar | null>(null);

/**
 * Mantiene el estado del hogar mientras se navega entre pantallas y lo guarda en el `almacen`.
 * Hoy el almacén es local (modo prueba, sin cuenta); con acceso por cuenta será el de Supabase.
 * Se carga después del primer pintado para que servidor y navegador generen el mismo HTML.
 */
export function ProveedorHogar({
  children,
  almacen,
}: {
  children: ReactNode;
  almacen?: AlmacenHogar;
}) {
  const [estado, despachar] = useReducer(reducir, undefined, estadoInicialDemo);
  const primera = useRef(true);
  const almacenActual = useRef<AlmacenHogar | null>(null);

  useEffect(() => {
    const a = almacen ?? crearAlmacenLocal(window.localStorage);
    almacenActual.current = a;
    const guardado = a.cargar();
    if (guardado) despachar({ tipo: "hogar/sustituir", estado: guardado });
  }, [almacen]);

  useEffect(() => {
    // El primer estado es el de ejemplo: no debe pisar lo guardado antes de haberlo cargado.
    if (primera.current) {
      primera.current = false;
      return;
    }
    almacenActual.current?.guardar(estado);
  }, [estado]);

  const valor = useMemo<ContextoHogar>(
    () => ({
      estado,
      despachar,
      restablecer: () => {
        almacenActual.current?.borrar();
        despachar({ tipo: "hogar/sustituir", estado: estadoInicialDemo() });
      },
    }),
    [estado],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useHogar(): ContextoHogar {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useHogar debe usarse dentro de <ProveedorHogar>");
  return contexto;
}
