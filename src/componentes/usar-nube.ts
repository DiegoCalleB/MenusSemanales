"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Accion, EstadoHogar } from "@/aplicacion/estado";
import { type EstadoSync, Sincronizador } from "@/aplicacion/sincronizacion";
import { aUuid, cambiosDePersonas } from "@/aplicacion/tablas";
import type { Persona } from "@/dominio/tipos";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import {
  type HogarDeUsuario,
  crearHogarNuevo,
  aplicarCambiosATablas,
  crearInvitacion,
  crearInvitacionDePersona,
  entrarSinCorreo,
  leerHogarDeTablas,
  miPersonaEnElHogar,
  vincularmeAPersona,
  hogarDelUsuario,
  mensajeDeError,
  pedirCodigoPorCorreo,
  salir,
  unirseConCodigo,
  usuarioActual,
  verificarCodigo,
} from "@/infraestructura/supabase/cuenta";
import { type EstadoConfigNube, diagnosticarEnvPublico } from "@/infraestructura/env";
import { guardarRespaldoAntesDeLaNube } from "@/infraestructura/respaldo";
import type { Database, Json } from "@/infraestructura/supabase/database.types";
import { crearNube } from "@/infraestructura/supabase/nube";

/** Asegura que las personas del estado están en la tabla `persona` (con ids UUID estables). */
async function llevarPersonas(
  c: SupabaseClient<Database>,
  hogarId: string,
  personas: Persona[],
): Promise<Resultado> {
  try {
    const { error } = await aplicarCambiosATablas(
      c,
      hogarId,
      cambiosDePersonas(hogarId, personas) as unknown as Json,
    );
    return error ? { ok: false, mensaje: mensajeDeError(error) } : { ok: true };
  } catch (e) {
    return { ok: false, mensaje: mensajeDeError({ message: e instanceof Error ? e.message : "" }) };
  }
}

export type FaseCuenta = "sin-configurar" | "cargando" | "sin-sesion" | "sin-hogar" | "conectado";
export type Resultado = { ok: true } | { ok: false; mensaje: string };

/** Qué personas tienen ya cuenta y cuál soy yo (ids tal y como están en el estado de la app). */
export interface VinculosPersonas {
  mia: string | null;
  vinculadas: string[];
  esAdmin: boolean;
}

export interface CuentaContexto {
  fase: FaseCuenta;
  correo: string | null;
  anonimo: boolean;
  hogar: HogarDeUsuario | null;
  sync: EstadoSync;
  pedirCodigo: (correo: string) => Promise<Resultado>;
  verificar: (correo: string, codigo: string) => Promise<Resultado>;
  entrarSinCorreo: () => Promise<Resultado>;
  crearHogar: (nombre: string) => Promise<Resultado>;
  unirse: (codigo: string) => Promise<Resultado>;
  invitar: () => Promise<{ ok: true; codigo: string } | { ok: false; mensaje: string }>;
  /** Lleva las personas a la tabla y dice quién tiene cuenta (D-092). */
  vinculos: (
    personas: Persona[],
  ) => Promise<({ ok: true } & VinculosPersonas) | { ok: false; mensaje: string }>;
  invitarPersona: (
    personas: Persona[],
    personaId: string,
  ) => Promise<{ ok: true; codigo: string } | { ok: false; mensaje: string }>;
  vincularme: (personas: Persona[], personaId: string) => Promise<Resultado>;
  salir: () => Promise<void>;
}

/** Estado de las variables de Supabase de esta versión (se incrustan al construir). */
export const ESTADO_NUBE: EstadoConfigNube = diagnosticarEnvPublico({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  clave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

/** ¿Está bien configurada la nube en esta versión? */
export const NUBE_DISPONIBLE = ESTADO_NUBE === "ok";

/** Aviso interno: hay una copia automática nueva (la pantalla de Cuenta la enseña). */
export const EVENTO_RESPALDOS = "menus-semanales:respaldos";
const almacenamientoLocal = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const ESPERA_GUARDADO_MS = 800;

/**
 * Cuenta y sincronización del hogar (D-063). Entra con correo (código de 6 cifras) o sin correo,
 * crea o se une a un hogar con un código de invitación y mantiene el plan al día entre dispositivos.
 * Si la nube no está configurada, no hace nada y la app sigue en modo local.
 */
export function useNube(
  leerEstado: () => EstadoHogar,
  escribirEstado: (e: EstadoHogar) => void,
): { cuenta: CuentaContexto; registrar: (a: Accion) => void } {
  const [fase, setFase] = useState<FaseCuenta>(NUBE_DISPONIBLE ? "cargando" : "sin-configurar");
  const [correo, setCorreo] = useState<string | null>(null);
  const [anonimo, setAnonimo] = useState(false);
  const [hogar, setHogar] = useState<HogarDeUsuario | null>(null);
  const [sync, setSync] = useState<EstadoSync>("inactivo");
  const cliente = useRef<SupabaseClient<Database> | null>(null);
  const sincronizador = useRef<Sincronizador | null>(null);
  const cerrar = useRef<(() => void) | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leer = useRef(leerEstado);
  const escribir = useRef(escribirEstado);
  useEffect(() => {
    leer.current = leerEstado;
    escribir.current = escribirEstado;
  });

  const desconectar = useCallback(() => {
    cerrar.current?.();
    cerrar.current = null;
    sincronizador.current = null;
    if (temporizador.current) clearTimeout(temporizador.current);
    setSync("inactivo");
  }, []);

  const conectar = useCallback(
    async (c: SupabaseClient<Database>, h: HogarDeUsuario): Promise<Resultado> => {
      desconectar();
      const nube = crearNube(c, h.id);
      const s = new Sincronizador(nube, {
        leer: () => leer.current(),
        escribir: (e) => escribir.current(e),
        avisar: setSync,
        antesDeAdoptar: (local, remoto) => {
          const r = guardarRespaldoAntesDeLaNube(almacenamientoLocal(), local, remoto, new Date());
          if (r === "guardada") window.dispatchEvent(new Event(EVENTO_RESPALDOS));
        },
      });
      try {
        await s.iniciar();
      } catch (e) {
        return { ok: false, mensaje: e instanceof Error ? e.message : "No se pudo sincronizar." };
      }
      sincronizador.current = s;
      const baja = nube.suscribir((r) => s.recibir(r));
      const alVolver = () => {
        if (document.visibilityState !== "visible") return;
        void nube
          .leer()
          .then((r) => r && s.recibir(r))
          .catch(() => undefined);
        void s.sincronizar();
      };
      document.addEventListener("visibilitychange", alVolver);
      window.addEventListener("online", alVolver);
      cerrar.current = () => {
        baja();
        document.removeEventListener("visibilitychange", alVolver);
        window.removeEventListener("online", alVolver);
      };
      setHogar(h);
      setFase("conectado");
      return { ok: true };
    },
    [desconectar],
  );

  const resolverSesion = useCallback(
    async (c: SupabaseClient<Database>) => {
      const usuario = await usuarioActual(c);
      if (!usuario) {
        desconectar();
        setCorreo(null);
        setAnonimo(false);
        setHogar(null);
        setFase("sin-sesion");
        return;
      }
      setCorreo(usuario.email ?? null);
      setAnonimo(Boolean(usuario.is_anonymous));
      const h = await hogarDelUsuario(c);
      if (!h) {
        setHogar(null);
        setFase("sin-hogar");
        return;
      }
      await conectar(c, h);
    },
    [conectar, desconectar],
  );

  useEffect(() => {
    if (!NUBE_DISPONIBLE) return;
    let c: SupabaseClient<Database>;
    try {
      c = crearClienteNavegador();
    } catch (e) {
      // Variables de Supabase mal puestas (clave o URL con otra forma): la app sigue en modo local
      // en vez de caerse entera, y el motivo queda en la consola.
      console.error(e);
      void Promise.resolve().then(() => setFase("sin-configurar"));
      return;
    }
    cliente.current = c;
    // Tras el primer pintado: lee la sesión del navegador sin tocar el estado dentro del efecto.
    void Promise.resolve().then(() => resolverSesion(c));
    return () => desconectar();
  }, [resolverSesion, desconectar]);

  const registrar = useCallback((accion: Accion) => {
    const s = sincronizador.current;
    if (!s) return;
    s.registrar(accion);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void s.sincronizar(), ESPERA_GUARDADO_MS);
  }, []);

  const usar = <T>(f: (c: SupabaseClient<Database>) => Promise<T>) => {
    const c = cliente.current;
    if (!c) return Promise.reject(new Error("La nube no está configurada."));
    return f(c);
  };
  const aResultado = async (
    p: Promise<{ error: { message?: string; code?: string } | null }>,
  ): Promise<Resultado> => {
    try {
      const { error } = await p;
      return error ? { ok: false, mensaje: mensajeDeError(error) } : { ok: true };
    } catch (e) {
      return {
        ok: false,
        mensaje: mensajeDeError({ message: e instanceof Error ? e.message : "" }),
      };
    }
  };

  const cuenta: CuentaContexto = {
    fase,
    correo,
    anonimo,
    hogar,
    sync,
    pedirCodigo: (mail) => usar((c) => aResultado(pedirCodigoPorCorreo(c, mail))),
    verificar: async (mail, codigo) => {
      const r = await usar((c) => aResultado(verificarCodigo(c, mail, codigo)));
      if (r.ok && cliente.current) await resolverSesion(cliente.current);
      return r;
    },
    entrarSinCorreo: async () => {
      const r = await usar((c) => aResultado(entrarSinCorreo(c)));
      if (r.ok && cliente.current) await resolverSesion(cliente.current);
      return r;
    },
    crearHogar: async (nombre) => {
      const c = cliente.current;
      if (!c) return { ok: false, mensaje: "La nube no está configurada." };
      const { error } = await crearHogarNuevo(c, nombre.trim() || "Mi hogar");
      if (error) return { ok: false, mensaje: mensajeDeError(error) };
      await resolverSesion(c);
      return { ok: true };
    },
    unirse: async (codigo) => {
      const c = cliente.current;
      if (!c) return { ok: false, mensaje: "La nube no está configurada." };
      const { error } = await unirseConCodigo(c, codigo);
      if (error) return { ok: false, mensaje: mensajeDeError(error) };
      await resolverSesion(c);
      return { ok: true };
    },
    invitar: async () => {
      const c = cliente.current;
      if (!c || !hogar) return { ok: false, mensaje: "Primero crea el hogar." };
      const { data, error } = await crearInvitacion(c, hogar.id);
      return error || !data
        ? { ok: false, mensaje: mensajeDeError(error) }
        : { ok: true, codigo: data };
    },
    vinculos: async (personas) => {
      const c = cliente.current;
      if (!c || !hogar) return { ok: false, mensaje: "Primero crea el hogar." };
      const subida = await llevarPersonas(c, hogar.id, personas);
      if (!subida.ok) return subida;
      const [lectura, mia] = await Promise.all([
        leerHogarDeTablas(c, hogar.id),
        miPersonaEnElHogar(c, hogar.id),
      ]);
      if (lectura.error || mia.error) {
        return { ok: false, mensaje: mensajeDeError(lectura.error ?? mia.error) };
      }
      const filas = (
        lectura.data as { personas?: Array<{ id: string; vinculada: boolean }> } | null
      )?.personas;
      const deUuid = new Map(personas.map((p) => [aUuid(hogar.id, p.id), p.id]));
      return {
        ok: true,
        mia: mia.data ? (deUuid.get(mia.data) ?? null) : null,
        vinculadas: (filas ?? [])
          .filter((f) => f.vinculada)
          .map((f) => deUuid.get(f.id))
          .filter((id): id is string => id !== undefined),
        esAdmin: hogar.rol === "admin",
      };
    },
    invitarPersona: async (personas, personaId) => {
      const c = cliente.current;
      if (!c || !hogar) return { ok: false, mensaje: "Primero crea el hogar." };
      const subida = await llevarPersonas(c, hogar.id, personas);
      if (!subida.ok) return subida;
      const { data, error } = await crearInvitacionDePersona(
        c,
        hogar.id,
        aUuid(hogar.id, personaId),
      );
      return error || !data
        ? { ok: false, mensaje: mensajeDeError(error) }
        : { ok: true, codigo: data };
    },
    vincularme: async (personas, personaId) => {
      const c = cliente.current;
      if (!c || !hogar) return { ok: false, mensaje: "Primero crea el hogar." };
      const subida = await llevarPersonas(c, hogar.id, personas);
      if (!subida.ok) return subida;
      const { error } = await vincularmeAPersona(c, hogar.id, aUuid(hogar.id, personaId));
      return error ? { ok: false, mensaje: mensajeDeError(error) } : { ok: true };
    },
    salir: async () => {
      const c = cliente.current;
      if (!c) return;
      desconectar();
      await salir(c);
      await resolverSesion(c);
    },
  };
  return { cuenta, registrar };
}
