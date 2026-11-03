import { type Accion, type EstadoHogar, normalizar, reducir } from "./estado";

/**
 * Sincronización del hogar entre dispositivos (D-063). El plan de la familia es un documento con
 * versión en la nube. Cada dispositivo aplica sus cambios al instante (el reductor de siempre) y los
 * apunta en una cola. Al guardar, si la versión de la nube sigue siendo la que conoce, se sube el
 * estado; si otro dispositivo guardó antes, se baja lo nuevo y se **reaplican los cambios propios
 * encima** (el reductor es puro, así que repetirlos es seguro). No se pierde nada de nadie.
 */

export interface EstadoRemoto {
  estado: EstadoHogar;
  version: number;
}

/** La nube rechaza un guardado porque otro dispositivo guardó antes. */
export class ConflictoVersion extends Error {
  constructor() {
    super("Conflicto de versión");
    this.name = "ConflictoVersion";
  }
}

export interface Nube {
  /** Estado guardado del hogar, o null si aún no hay. */
  leer(): Promise<EstadoRemoto | null>;
  /** Guarda si `versionEsperada` es la actual (0 = no hay estado). Devuelve la versión nueva. */
  guardar(estado: EstadoHogar, versionEsperada: number): Promise<number>;
}

export type EstadoSync = "inactivo" | "guardando" | "al-dia" | "sin-conexion" | "error";

export interface EntornoLocal {
  leer: () => EstadoHogar;
  escribir: (estado: EstadoHogar) => void;
  avisar: (estado: EstadoSync) => void;
  /** Se llama justo antes de que el estado de la nube sustituya al de este dispositivo. */
  antesDeAdoptar?: (local: EstadoHogar, nube: EstadoHogar) => void;
}

/** Acciones que no son cambios del hogar: no se sincronizan. */
export const esAccionSincronizable = (a: Accion): boolean =>
  a.tipo !== "cerrarAviso" &&
  a.tipo !== "aviso/error" &&
  a.tipo !== "hogar/sustituir" &&
  a.tipo !== "hogar/hoy";

/** Lo que se guarda en la nube: sin avisos pasajeros. «Hoy» lo pone cada dispositivo. */
export const paraNube = (e: EstadoHogar): EstadoHogar => ({ ...e, aviso: null });

/** Estado de la nube para este dispositivo: conserva su propio «hoy». */
export const desdeNube = (remoto: EstadoHogar, local: EstadoHogar): EstadoHogar =>
  normalizar({ ...remoto, hoy: local.hoy, aviso: null });

/** Reaplica cambios propios sobre el estado de la nube. */
export function rebasar(
  remoto: EstadoHogar,
  acciones: readonly Accion[],
  local: EstadoHogar,
): EstadoHogar {
  return acciones.reduce(reducir, desdeNube(remoto, local));
}

const MAX_REINTENTOS = 5;

export class Sincronizador {
  version = 0;
  private pendientes: Accion[] = [];
  private ocupado = false;
  private otraVez = false;

  constructor(
    private readonly nube: Nube,
    private readonly entorno: EntornoLocal,
  ) {}

  get hayPendientes(): boolean {
    return this.pendientes.length > 0;
  }

  /**
   * Primer contacto con la nube. Si ya hay estado, se adopta (es el de la familia). Si no, se sube
   * el de este dispositivo para que los demás lo reciban.
   */
  async iniciar(): Promise<"subido" | "adoptado"> {
    this.entorno.avisar("guardando");
    try {
      const remoto = await this.nube.leer();
      if (remoto) {
        this.version = remoto.version;
        this.pendientes = [];
        // Lo de este dispositivo se va a sustituir por lo de la familia: que quede una copia.
        this.entorno.antesDeAdoptar?.(
          this.entorno.leer(),
          desdeNube(remoto.estado, this.entorno.leer()),
        );
        this.entorno.escribir(desdeNube(remoto.estado, this.entorno.leer()));
        this.entorno.avisar("al-dia");
        return "adoptado";
      }
      this.version = await this.nube.guardar(paraNube(this.entorno.leer()), 0);
      this.entorno.avisar("al-dia");
      return "subido";
    } catch (e) {
      this.entorno.avisar(esErrorDeRed(e) ? "sin-conexion" : "error");
      throw e;
    }
  }

  /** Apunta un cambio hecho en este dispositivo para subirlo. */
  registrar(accion: Accion): void {
    if (esAccionSincronizable(accion)) this.pendientes.push(accion);
  }

  /** Sube los cambios pendientes; si hay conflicto, reaplica los propios sobre lo nuevo. */
  async sincronizar(): Promise<void> {
    if (this.ocupado) {
      this.otraVez = true;
      return;
    }
    if (this.pendientes.length === 0) return;
    this.ocupado = true;
    try {
      do {
        this.otraVez = false;
        await this.intentarGuardar();
      } while (this.otraVez && this.pendientes.length > 0);
    } finally {
      this.ocupado = false;
    }
  }

  private async intentarGuardar(): Promise<void> {
    this.entorno.avisar("guardando");
    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      const incluidas = this.pendientes.length;
      try {
        this.version = await this.nube.guardar(paraNube(this.entorno.leer()), this.version);
        this.pendientes = this.pendientes.slice(incluidas);
        this.entorno.avisar("al-dia");
        return;
      } catch (e) {
        if (!(e instanceof ConflictoVersion)) {
          this.entorno.avisar(esErrorDeRed(e) ? "sin-conexion" : "error");
          return;
        }
        const remoto = await this.nube.leer().catch(() => null);
        if (!remoto) {
          this.entorno.avisar("sin-conexion");
          return;
        }
        this.version = remoto.version;
        this.entorno.escribir(rebasar(remoto.estado, this.pendientes, this.entorno.leer()));
      }
    }
    this.entorno.avisar("error");
  }

  /** Llega un cambio de otro dispositivo (Realtime). */
  recibir(remoto: EstadoRemoto): void {
    if (remoto.version <= this.version) return; // el eco de nuestro propio guardado
    this.version = remoto.version;
    this.entorno.escribir(rebasar(remoto.estado, this.pendientes, this.entorno.leer()));
    this.entorno.avisar(this.pendientes.length > 0 ? "guardando" : "al-dia");
  }
}

function esErrorDeRed(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return /fetch|network|failed to|conexi|timeout/i.test(m);
}
