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
import { estadoModoDiego } from "@/aplicacion/datos-diego";
import { type Accion, type EstadoHogar, reducir } from "@/aplicacion/estado";
import { crearAlmacenLocal } from "@/infraestructura/almacen-local";

/**
 * Qué datos de prueba se usan. Por defecto, el «modo Diego» (la familia real de Diego, D-053). Los
 * tests E2E construyen con `NEXT_PUBLIC_DATOS=ejemplo` para tener datos fijos y repetibles.
 */
export const MODO_DATOS: "diego" | "ejemplo" =
  process.env.NEXT_PUBLIC_DATOS === "ejemplo" ? "ejemplo" : "diego";

/** Fecha de hoy en el dispositivo (AAAA-MM-DD, hora local). */
const hoyLocal = (): string => new Intl.DateTimeFormat("sv-SE").format(new Date());
const FECHA_BASE = "2026-11-01";

const estadoInicial = () =>
  MODO_DATOS === "ejemplo" ? estadoInicialDemo() : estadoModoDiego(FECHA_BASE);

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
  const [estado, despachar] = useReducer(reducir, undefined, estadoInicial);
  const primera = useRef(true);
  const almacenActual = useRef<AlmacenHogar | null>(null);

  useEffect(() => {
    const a = almacen ?? crearAlmacenLocal(window.localStorage);
    almacenActual.current = a;
    const guardado = a.cargar();
    if (guardado) despachar({ tipo: "hogar/sustituir", estado: guardado });
    if (MODO_DATOS === "diego") despachar({ tipo: "hogar/hoy", fecha: hoyLocal() });
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
        despachar({ tipo: "hogar/sustituir", estado: estadoInicial() });
        if (MODO_DATOS === "diego") despachar({ tipo: "hogar/hoy", fecha: hoyLocal() });
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
