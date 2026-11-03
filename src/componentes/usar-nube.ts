"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Accion, EstadoHogar } from "@/aplicacion/estado";
import { peorEstado } from "@/aplicacion/guardado";
import { type EstadoSync, Sincronizador, esErrorDeRed } from "@/aplicacion/sincronizacion";
import { adaptadorCole, adaptadorMenu } from "@/aplicacion/adaptadores-tablas";
import { SincronizadorTablas } from "@/aplicacion/sincronizacion-tablas";
import {
  type CambiosCole,
  type LecturaCole,
  type ResumenCole,
  cambiosCompletosCole,
  conservarCamposDeCole,
  leerCole,
  resumenColeDeCambios,
  resumenColeDeLectura,
} from "@/aplicacion/tablas-cole";
import {
  type CambiosMenu,
  type LecturaMenu,
  leerMenu,
  type ResumenMenu,
  cambiosCompletosMenu,
  conservarCamposDeMenu,
  ingredientesPorResolver,
  migrarIdsDeMenu,
  resumenMenuDeCambios,
  resumenMenuDeLectura,
} from "@/aplicacion/tablas-menu";
import {
  type ResumenTablas,
  aUuid,
  cambiosDePersonas,
  cambiosParaImportar,
  conservarCamposDeTablas,
  leerTablas,
  migrarIdsDePersonas,
  resumenDeCambios,
  resumenDeLectura,
} from "@/aplicacion/tablas";
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
import {
  guardarRespaldoAntesDeImportar,
  guardarRespaldoAntesDeLaNube,
} from "@/infraestructura/respaldo";
import type { Database, Json } from "@/infraestructura/supabase/database.types";
import { crearNube } from "@/infraestructura/supabase/nube";
import { crearNubeCole } from "@/infraestructura/supabase/nube-cole";
import { crearNubeMenu } from "@/infraestructura/supabase/nube-menu";
import { crearNubeTablas } from "@/infraestructura/supabase/nube-tablas";

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

/** Claves de lo que se guarda en el móvil para no perder cambios sin conexión (D-102). */
export const PREFIJO_PENDIENTES = "menus-semanales:pendientes:";
export const PREFIJO_BASE = "menus-semanales:base:";
const CLAVE_HOGAR = "menus-semanales:hogar";

/** Borra lo pendiente y las bases guardadas (p. ej. al restablecer el ejemplo): nada debe reenviarse. */
export function olvidarPendientes(): void {
  const a = almacenamientoLocal();
  if (!a) return;
  try {
    const claves: string[] = [];
    for (let i = 0; i < a.length; i++) {
      const k = a.key(i);
      if (k && (k.startsWith(PREFIJO_PENDIENTES) || k.startsWith(PREFIJO_BASE))) claves.push(k);
    }
    for (const k of claves) a.removeItem(k);
  } catch {
    /* sin almacenamiento */
  }
}

function leerJson(clave: string): unknown {
  try {
    const t = almacenamientoLocal()?.getItem(clave);
    return t ? JSON.parse(t) : null;
  } catch {
    return null;
  }
}
function guardarJson(clave: string, valor: unknown): void {
  try {
    almacenamientoLocal()?.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin espacio: la app sigue; el aviso de «sin guardar» sigue visible */
  }
}

/** Cambios sin enviar: solo se aceptan acciones con forma válida. */
function pendientesGuardados(hogarId: string): Accion[] {
  const v = leerJson(`${PREFIJO_PENDIENTES}${hogarId}`);
  return Array.isArray(v)
    ? (v.filter(
        (a) => typeof a === "object" && a !== null && typeof a.tipo === "string",
      ) as Accion[])
    : [];
}

/** Lo último que se sabe que hay en tablas, validado: si no vale, se ignora y se adopta lo de la nube. */
function persistenciaDe<L>(hogarId: string, nombre: string, validar: (j: unknown) => L) {
  const clave = `${PREFIJO_BASE}${nombre}:${hogarId}`;
  return {
    cargar: (): L | null => {
      const v = leerJson(clave);
      if (v === null) return null;
      try {
        return validar(v);
      } catch {
        return null;
      }
    },
    guardar: (l: L) => guardarJson(clave, l),
  };
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
  /** El peor estado de guardado entre el documento y los motores por tablas. */
  sync: EstadoSync;
  /** Qué parte de los datos ya manda desde tablas (el resto sigue en el documento). */
  tablas: { hogar: boolean; menu: boolean; cole: boolean };
  /** ¿Tiene internet el móvil ahora mismo? */
  enLinea: boolean;
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
  /** Qué se llevaría a las tablas y qué hay ya en ellas (D-094). */
  vistaPreviaTablas: (estado: EstadoHogar) => Promise<
    | {
        ok: true;
        seLlevaria: ResumenTablas & ResumenMenu & ResumenCole;
        yaHay: ResumenTablas & ResumenMenu & ResumenCole;
      }
    | { ok: false; mensaje: string }
  >;
  /** Lleva los datos del documento a las tablas, tras guardar una copia en este móvil. */
  importarATablas: (estado: EstadoHogar) => Promise<Resultado>;
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
  const [syncDoc, setSync] = useState<EstadoSync>("inactivo");
  const [syncHogar, setSyncHogar] = useState<EstadoSync>("inactivo");
  const [syncMenu, setSyncMenu] = useState<EstadoSync>("inactivo");
  const [syncCole, setSyncCole] = useState<EstadoSync>("inactivo");
  const [modoTablas, setModoTablas] = useState({ hogar: false, menu: false, cole: false });
  const sync = peorEstado(syncDoc, syncHogar, syncMenu, syncCole);
  const [enLinea, setEnLinea] = useState(true);
  useEffect(() => {
    const poner = () => setEnLinea(navigator.onLine);
    poner();
    window.addEventListener("online", poner);
    window.addEventListener("offline", poner);
    return () => {
      window.removeEventListener("online", poner);
      window.removeEventListener("offline", poner);
    };
  }, []);
  const cliente = useRef<SupabaseClient<Database> | null>(null);
  const sincronizador = useRef<Sincronizador | null>(null);
  const tablas = useRef<SincronizadorTablas | null>(null);
  const menu = useRef<SincronizadorTablas<LecturaMenu, CambiosMenu> | null>(null);
  const cole = useRef<SincronizadorTablas<LecturaCole, CambiosCole> | null>(null);
  const temporizadorCole = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cerrarMenu = useRef<(() => void) | null>(null);
  const temporizadorMenu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolucionMenu = useRef<() => Record<string, string>>(() => ({}));
  const cerrarTablas = useRef<(() => void) | null>(null);
  const temporizadorTablas = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    cerrarTablas.current?.();
    cerrarTablas.current = null;
    tablas.current = null;
    cerrarMenu.current?.();
    cerrarMenu.current = null;
    menu.current = null;
    if (temporizadorTablas.current) clearTimeout(temporizadorTablas.current);
    if (temporizadorMenu.current) clearTimeout(temporizadorMenu.current);
    setSyncHogar("inactivo");
    setSyncMenu("inactivo");
    setSyncCole("inactivo");
    cole.current = null;
    if (temporizadorCole.current) clearTimeout(temporizadorCole.current);
    setModoTablas({ hogar: false, menu: false, cole: false });
    sincronizador.current = null;
    if (temporizador.current) clearTimeout(temporizador.current);
    setSync("inactivo");
  }, []);

  /**
   * Enciende el motor por tablas si el hogar ya tiene sus datos en ellas (D-095). Si no, sigue
   * mandando el documento hasta que se lleven a tablas desde «Cuenta».
   */
  const activarTablas = useCallback(
    async (c: SupabaseClient<Database>, h: HogarDeUsuario): Promise<boolean> => {
      cerrarTablas.current?.();
      cerrarTablas.current = null;
      tablas.current = null;
      const nube = crearNubeTablas(c, h.id);
      const motor = new SincronizadorTablas(
        nube,
        {
          hogarId: h.id,
          leer: () => leer.current(),
          escribir: (e) => escribir.current(e),
          avisar: setSyncHogar,
          antesDeAdoptar: (local, nuevo) => {
            const r = guardarRespaldoAntesDeLaNube(almacenamientoLocal(), local, nuevo, new Date());
            if (r === "guardada") window.dispatchEvent(new Event(EVENTO_RESPALDOS));
          },
        },
        undefined,
        persistenciaDe(h.id, "hogar", leerTablas),
      );
      try {
        if ((await motor.iniciar()) !== "activo") return false;
      } catch (e) {
        console.error(e);
        return false;
      }
      tablas.current = motor;
      setModoTablas((m) => ({ ...m, hogar: true }));
      let espera: ReturnType<typeof setTimeout> | null = null;
      const baja = nube.suscribir(() => {
        if (espera) clearTimeout(espera);
        espera = setTimeout(() => void motor.recibir(), 300);
      });
      cerrarTablas.current = () => {
        baja();
        if (espera) clearTimeout(espera);
      };
      return true;
    },
    [],
  );

  /**
   * Enciende el motor del menú (platos, cenas, notas, comidas del mediodía, valoraciones) si el
   * hogar ya lo tiene en tablas (D-101). Va después del de personas: las valoraciones las nombran.
   */
  const activarMenu = useCallback(
    async (c: SupabaseClient<Database>, h: HogarDeUsuario): Promise<boolean> => {
      cerrarMenu.current?.();
      cerrarMenu.current = null;
      menu.current = null;
      const nube = crearNubeMenu(c, h.id);
      const { adaptador, resolucion } = adaptadorMenu(h.id, nube.resolver);
      const motor = new SincronizadorTablas<LecturaMenu, CambiosMenu>(
        nube,
        {
          hogarId: h.id,
          leer: () => leer.current(),
          escribir: (e) => escribir.current(e),
          avisar: setSyncMenu,
          antesDeAdoptar: (local, nuevo) => {
            const r = guardarRespaldoAntesDeLaNube(almacenamientoLocal(), local, nuevo, new Date());
            if (r === "guardada") window.dispatchEvent(new Event(EVENTO_RESPALDOS));
          },
        },
        adaptador,
        persistenciaDe(h.id, "menu", leerMenu),
      );
      try {
        if ((await motor.iniciar()) !== "activo") return false;
      } catch (e) {
        console.error(e);
        return false;
      }
      menu.current = motor;
      setModoTablas((m) => ({ ...m, menu: true }));
      resolucionMenu.current = resolucion;
      let espera: ReturnType<typeof setTimeout> | null = null;
      const baja = nube.suscribir(() => {
        if (espera) clearTimeout(espera);
        espera = setTimeout(() => void motor.recibir(), 300);
      });
      cerrarMenu.current = () => {
        baja();
        if (espera) clearTimeout(espera);
      };
      return true;
    },
    [],
  );

  /** Enciende el motor del menú del cole si el colegio del hogar ya lo tiene en tablas (D-104). */
  const activarCole = useCallback(
    async (c: SupabaseClient<Database>, h: HogarDeUsuario): Promise<boolean> => {
      cole.current = null;
      const motor = new SincronizadorTablas<LecturaCole, CambiosCole>(
        crearNubeCole(c, h.id),
        {
          hogarId: h.id,
          leer: () => leer.current(),
          escribir: (e) => escribir.current(e),
          avisar: setSyncCole,
          antesDeAdoptar: (local, nuevo) => {
            const r = guardarRespaldoAntesDeLaNube(almacenamientoLocal(), local, nuevo, new Date());
            if (r === "guardada") window.dispatchEvent(new Event(EVENTO_RESPALDOS));
          },
        },
        adaptadorCole,
        persistenciaDe(h.id, "cole", leerCole),
      );
      try {
        if ((await motor.iniciar()) !== "activo") return false;
      } catch (e) {
        console.error(e);
        return false;
      }
      cole.current = motor;
      setModoTablas((m) => ({ ...m, cole: true }));
      return true;
    },
    [],
  );

  /**
   * Lleva los datos del estado a las tablas (D-094, D-101) y enciende los motores por tablas. Se usa
   * a mano desde «Cuenta» y, solo, la primera vez que un hogar se conecta con las tablas vacías
   * (D-103). No borra nada y se puede repetir.
   */
  const importarDesde = useCallback(
    async (
      c: SupabaseClient<Database>,
      h: HogarDeUsuario,
      estado: EstadoHogar,
      // Qué agregados faltan por llevar a tablas. Solo se importan esos: lo que ya manda desde
      // tablas nunca se pisa con el documento (D-103/D-104).
      quedan: { hogar: boolean; menu: boolean; cole: boolean } = {
        hogar: true,
        menu: true,
        cole: true,
      },
    ): Promise<Resultado> => {
      // 1. Copia en este móvil. Si no se puede guardar, no se sigue: sin red de seguridad no se importa.
      const copia = guardarRespaldoAntesDeImportar(almacenamientoLocal(), estado, new Date());
      if (copia === "no-se-pudo") {
        return {
          ok: false,
          mensaje: "No se ha podido guardar la copia de seguridad en este móvil: no importo nada.",
        };
      }
      if (copia === "guardada") window.dispatchEvent(new Event(EVENTO_RESPALDOS));
      const fallos: string[] = [];

      // 2-3. Personas, cumpleaños, agenda, casa y tareas. Las personas primero (para saber cuál
      // soy yo y no tocar mi propio regalo); lo demás, de una vez (todo o nada).
      if (quedan.hogar) {
        const subida = await llevarPersonas(c, h.id, estado.personas);
        if (!subida.ok) return subida;
        const mia = await miPersonaEnElHogar(c, h.id);
        if (mia.error) return { ok: false, mensaje: mensajeDeError(mia.error) };
        const deUuid = new Map(estado.personas.map((p) => [aUuid(h.id, p.id), p.id]));
        const miId = mia.data ? (deUuid.get(mia.data) ?? null) : null;
        const { error } = await aplicarCambiosATablas(
          c,
          h.id,
          cambiosParaImportar(estado, h.id, miId) as unknown as Json,
        );
        if (error) return { ok: false, mensaje: mensajeDeError(error) };
      }

      // 4. El menú: platos, cenas, notas, comidas del mediodía, valoraciones. Los ingredientes se
      // emparejan por nombre con el catálogo compartido (creando los que falten).
      let menuListo = quedan.menu;
      if (quedan.menu) {
        const nubeMenu = crearNubeMenu(c, h.id);
        try {
          await nubeMenu.leer();
          const resolucion = await nubeMenu.resolver(ingredientesPorResolver(estado));
          const migrado = migrarIdsDePersonas(migrarIdsDeMenu(estado, h.id, resolucion), h.id);
          await nubeMenu.aplicar(cambiosCompletosMenu(migrado, h.id));
        } catch (e) {
          menuListo = false;
          fallos.push(
            `el menú (${mensajeDeError({ message: e instanceof Error ? e.message : "" })} ¿Está aplicada la migración del menú?)`,
          );
        }
      }

      // 5. El menú del cole, en el colegio del hogar (se crea la primera vez).
      let coleListo = quedan.cole;
      if (quedan.cole) {
        const nubeCole = crearNubeCole(c, h.id);
        try {
          await nubeCole.leer();
          const cambios = cambiosCompletosCole(estado);
          if (cambios.dias) await nubeCole.aplicar(cambios);
          else coleListo = false; // no hay menú del cole que llevar
        } catch (e) {
          coleListo = false;
          fallos.push(
            `el menú del cole (${mensajeDeError({ message: e instanceof Error ? e.message : "" })} ¿Está aplicada la migración del cole?)`,
          );
        }
      }

      // Desde ahora mandan las tablas: se enciende cada motor sin tocar el del documento.
      if (quedan.hogar) await activarTablas(c, h);
      if (menuListo) await activarMenu(c, h);
      if (coleListo) await activarCole(c, h);
      return fallos.length === 0
        ? { ok: true }
        : { ok: false, mensaje: `Se llevó lo demás, pero falló: ${fallos.join("; ")}.` };
    },
    [activarTablas, activarMenu, activarCole],
  );

  const reconectar = useRef<
    ((c: SupabaseClient<Database>, h: HogarDeUsuario) => Promise<Resultado>) | null
  >(null);

  const conectar = useCallback(
    async (c: SupabaseClient<Database>, h: HogarDeUsuario): Promise<Resultado> => {
      desconectar();
      const nube = crearNube(c, h.id);
      const s = new Sincronizador(nube, {
        leer: () => leer.current(),
        // Si mandan las tablas, lo que llega del documento no pisa lo que viene de ellas.
        escribir: (e) => {
          let x = tablas.current ? conservarCamposDeTablas(e, leer.current(), h.id) : e;
          if (menu.current) {
            x = conservarCamposDeMenu(x, leer.current(), h.id, resolucionMenu.current());
          }
          if (cole.current) x = conservarCamposDeCole(x, leer.current());
          escribir.current(x);
        },
        avisar: setSync,
        cargarPendientes: () => pendientesGuardados(h.id),
        guardarPendientes: (a) => guardarJson(`${PREFIJO_PENDIENTES}${h.id}`, a),
        antesDeAdoptar: (local, remoto) => {
          const r = guardarRespaldoAntesDeLaNube(almacenamientoLocal(), local, remoto, new Date());
          if (r === "guardada") window.dispatchEvent(new Event(EVENTO_RESPALDOS));
        },
      });
      try {
        await s.iniciar();
      } catch (e) {
        if (esErrorDeRed(e) || (typeof navigator !== "undefined" && !navigator.onLine)) {
          // Sin internet al abrir: se sigue trabajando, todo se apunta en el móvil y se envía en
          // cuanto vuelva la conexión (D-102). La franja avisa de que aún no está en la nube.
          s.prepararSinConexion();
          sincronizador.current = s;
          setHogar(h);
          setFase("conectado");
          const reintentar = () => {
            window.removeEventListener("online", reintentar);
            void reconectar.current?.(c, h);
          };
          window.addEventListener("online", reintentar);
          cerrar.current = () => window.removeEventListener("online", reintentar);
          return { ok: true };
        }
        return { ok: false, mensaje: e instanceof Error ? e.message : "No se pudo sincronizar." };
      }
      sincronizador.current = s;
      guardarJson(CLAVE_HOGAR, h);
      const hogarListo = await activarTablas(c, h);
      const menuListo = await activarMenu(c, h);
      const coleListo = await activarCole(c, h);
      // Si el hogar aún tiene sus datos solo en el documento, se pasan a tablas ahora, solos
      // (D-103): con copia previa en el móvil, sin borrar nada y solo la primera vez.
      const inicial = s.estadoInicial;
      if (inicial && inicial.personas.length > 0) {
        const quedan = {
          hogar: !hogarListo,
          menu: !menuListo,
          // Sin menú del cole en el documento no hay nada que llevar.
          cole: !coleListo && Object.keys(inicial.colegio).length > 0,
        };
        if (quedan.hogar || quedan.menu || quedan.cole) {
          void importarDesde(c, h, inicial, quedan).then((r) => {
            if (!r.ok) console.error("Importación automática a tablas:", r.mensaje);
          });
        }
      }
      // Lo que quedó sin enviar la última vez (p. ej. se cerró la app sin conexión) se envía ya.
      if (s.hayPendientes) void s.sincronizar();
      const baja = nube.suscribir((r) => s.recibir(r));
      const alVolver = () => {
        if (document.visibilityState !== "visible") return;
        void tablas.current?.recibir();
        void tablas.current?.sincronizar();
        void menu.current?.recibir();
        void menu.current?.sincronizar();
        void cole.current?.recibir();
        void cole.current?.sincronizar();
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
    [desconectar, activarTablas, activarMenu, activarCole, importarDesde],
  );

  useEffect(() => {
    reconectar.current = conectar;
  }, [conectar]);

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
      let h = await hogarDelUsuario(c);
      if (!h && typeof navigator !== "undefined" && !navigator.onLine) {
        // Sin internet no se puede preguntar por el hogar: se usa el último conocido.
        const guardado = leerJson(CLAVE_HOGAR) as HogarDeUsuario | null;
        if (guardado && typeof guardado.id === "string") h = guardado;
      }
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
    if (tablas.current) {
      const motor = tablas.current;
      if (temporizadorTablas.current) clearTimeout(temporizadorTablas.current);
      temporizadorTablas.current = setTimeout(() => void motor.sincronizar(), ESPERA_GUARDADO_MS);
    }
    if (menu.current) {
      const motor = menu.current;
      if (temporizadorMenu.current) clearTimeout(temporizadorMenu.current);
      temporizadorMenu.current = setTimeout(() => void motor.sincronizar(), ESPERA_GUARDADO_MS);
    }
    if (cole.current) {
      const motor = cole.current;
      if (temporizadorCole.current) clearTimeout(temporizadorCole.current);
      temporizadorCole.current = setTimeout(() => void motor.sincronizar(), ESPERA_GUARDADO_MS);
    }
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
    tablas: modoTablas,
    enLinea,
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
    vistaPreviaTablas: async (estado) => {
      const c = cliente.current;
      if (!c || !hogar) return { ok: false, mensaje: "Primero crea el hogar." };
      const { data, error } = await leerHogarDeTablas(c, hogar.id);
      if (error) return { ok: false, mensaje: mensajeDeError(error) };
      try {
        const hogarHoy = {
          seLlevaria: resumenDeCambios(cambiosParaImportar(estado, hogar.id, null)),
          yaHay: resumenDeLectura(leerTablas(data)),
        };
        // El menú: si la base de datos aún no tiene sus funciones (falta aplicar la migración),
        // se enseña a cero y la importación lo salta.
        let menuYaHay = resumenMenuDeLectura({
          ingredientes: [],
          platos: [],
          excluidos: [],
          comidas: [],
          notas: [],
          almuerzos: [],
          valoraciones: [],
        });
        try {
          menuYaHay = resumenMenuDeLectura(await crearNubeMenu(c, hogar.id).leer());
        } catch {
          /* sin migración del menú */
        }
        let coleYaHay: ResumenCole = { diasCole: 0 };
        try {
          coleYaHay = resumenColeDeLectura(await crearNubeCole(c, hogar.id).leer());
        } catch {
          /* sin migración del cole */
        }
        const coleSeLlevaria = resumenColeDeCambios(cambiosCompletosCole(estado));
        const menuSeLlevaria = resumenMenuDeCambios(
          cambiosCompletosMenu(
            migrarIdsDePersonas(migrarIdsDeMenu(estado, hogar.id, {}), hogar.id),
            hogar.id,
          ),
        );
        return {
          ok: true,
          seLlevaria: { ...hogarHoy.seLlevaria, ...menuSeLlevaria, ...coleSeLlevaria },
          yaHay: { ...hogarHoy.yaHay, ...menuYaHay, ...coleYaHay },
        };
      } catch {
        return { ok: false, mensaje: "Las tablas devolvieron algo que no entiendo." };
      }
    },
    importarATablas: async (estado) => {
      const c = cliente.current;
      if (!c || !hogar) return { ok: false, mensaje: "Primero crea el hogar." };
      return importarDesde(c, hogar, estado);
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
