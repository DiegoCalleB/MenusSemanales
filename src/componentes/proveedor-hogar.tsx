"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { AlmacenHogar } from "@/aplicacion/almacen";
import { estadoInicialDemo } from "@/aplicacion/datos-demo";
import { estadoModoDiego } from "@/aplicacion/datos-diego";
import { type Accion, type EstadoHogar, conIdBase, reducir } from "@/aplicacion/estado";
import { AVISO_CAMBIO, riesgoDeGuardado } from "@/aplicacion/guardado";
import { esAccionSincronizable } from "@/aplicacion/sincronizacion";
import { crearAlmacenLocal } from "@/infraestructura/almacen-local";
import { type CuentaContexto, NUBE_DISPONIBLE, olvidarPendientes, useNube } from "./usar-nube";

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
  /** Ya se ha leído lo guardado en este dispositivo (antes, el estado es el de ejemplo). */
  cargado: boolean;
  despachar: Dispatch<Accion>;
  /** Modo prueba: vuelve a los datos de ejemplo y olvida lo guardado. */
  restablecer: () => void;
}

const Contexto = createContext<ContextoHogar | null>(null);
const ContextoCuenta = createContext<CuentaContexto | null>(null);

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
  const [estado, despacharLocal] = useReducer(reducir, undefined, estadoInicial);
  const estadoActual = useRef(estado);
  useEffect(() => {
    estadoActual.current = estado;
  });
  const { cuenta, registrar } = useNube(
    () => estadoActual.current,
    (e) => despacharLocal({ tipo: "hogar/sustituir", estado: e }),
  );
  // Cada cambio se aplica al instante en este dispositivo y se apunta para subirlo a la nube.
  // Si la nube está configurada y algo impide guardar, SE AVISA en cada cambio (D-102): la app
  // nunca guarda solo en el móvil a escondidas.
  const situacion = useRef({
    nubeConfigurada: NUBE_DISPONIBLE,
    fase: cuenta.fase,
    sync: cuenta.sync,
    enLinea: cuenta.enLinea,
  });
  useEffect(() => {
    situacion.current = {
      nubeConfigurada: NUBE_DISPONIBLE,
      fase: cuenta.fase,
      sync: cuenta.sync,
      enLinea: cuenta.enLinea,
    };
  });
  const despachar = useCallback(
    (original: Accion) => {
      // El id de lo que se cree se decide aquí, una sola vez, para que sea el mismo en este
      // dispositivo, en la nube y en cualquier repetición de la acción (D-089).
      const accion = conIdBase(original, () => crypto.randomUUID());
      despacharLocal(accion);
      registrar(accion);
      if (esAccionSincronizable(accion)) {
        const riesgo = riesgoDeGuardado(situacion.current);
        if (riesgo) despacharLocal({ tipo: "aviso/error", texto: AVISO_CAMBIO[riesgo] });
      }
    },
    [registrar],
  );
  const primera = useRef(true);
  const [cargado, fijarCargado] = useState(false);
  const almacenActual = useRef<AlmacenHogar | null>(null);

  useEffect(() => {
    const a = almacen ?? crearAlmacenLocal(window.localStorage);
    almacenActual.current = a;
    const guardado = a.cargar();
    if (guardado) despacharLocal({ tipo: "hogar/sustituir", estado: guardado });
    if (MODO_DATOS === "diego") despacharLocal({ tipo: "hogar/hoy", fecha: hoyLocal() });
    // Se marca una sola vez, al terminar de leer lo guardado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fijarCargado(true);
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
      cargado,
      despachar,
      restablecer: () => {
        almacenActual.current?.borrar();
        olvidarPendientes();
        despacharLocal({ tipo: "hogar/sustituir", estado: estadoInicial() });
        if (MODO_DATOS === "diego") despacharLocal({ tipo: "hogar/hoy", fecha: hoyLocal() });
      },
    }),
    [estado, cargado, despachar],
  );

  return (
    <Contexto.Provider value={valor}>
      <ContextoCuenta.Provider value={cuenta}>{children}</ContextoCuenta.Provider>
    </Contexto.Provider>
  );
}

export function useHogar(): ContextoHogar {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useHogar debe usarse dentro de <ProveedorHogar>");
  return contexto;
}

export function useCuenta(): CuentaContexto {
  const contexto = useContext(ContextoCuenta);
  if (!contexto) throw new Error("useCuenta debe usarse dentro de <ProveedorHogar>");
  return contexto;
}
