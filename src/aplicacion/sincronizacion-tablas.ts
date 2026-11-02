import type { EstadoHogar } from "./estado";
import type { EstadoSync } from "./sincronizacion";
import {
  type CambiosTablas,
  type LecturaTablas,
  aplicarCambiosALectura,
  aplicarLecturaDeTablas,
  diferencias,
  hayHogarEnTablas,
  migrarIdsDePersonas,
} from "./tablas";

/**
 * Motor de sincronización por tablas (D-095). Sustituye, agregado a agregado, al documento: las
 * personas, cumpleaños, apuntes, fechas, tareas de casa y por persona, los días de «llego tarde» y
 * el horizonte viven en tablas; el resto sigue en el documento (D-063).
 *
 * No lleva cola de acciones: guarda `base` (lo que sabe que hay en las tablas) y, al sincronizar,
 * calcula por identificador qué ha cambiado el estado respecto a esa base y envía solo eso. Si
 * falla la red, la próxima vez se vuelve a calcular y no se pierde nada. Cuando llegan cambios de
 * otro dispositivo se mezclan fila a fila con los propios aún sin enviar.
 */

export interface NubeTablas {
  leer(): Promise<LecturaTablas>;
  aplicar(cambios: CambiosTablas): Promise<void>;
}

export interface EntornoTablas {
  hogarId: string;
  leer: () => EstadoHogar;
  escribir: (estado: EstadoHogar) => void;
  avisar: (estado: EstadoSync) => void;
  /** Justo antes de que las tablas sustituyan lo de este dispositivo. */
  antesDeAdoptar?: (local: EstadoHogar, nuevo: EstadoHogar) => void;
}

/** Los campos que viven en tablas, para saber si algo cambió de verdad. */
const camposDeTablas = (e: EstadoHogar) =>
  JSON.stringify([
    e.personas,
    e.horizonte,
    e.llegoTarde,
    e.saltados,
    e.cumples,
    e.agenda,
    e.eventos,
    e.casa,
    e.tareas,
  ]);

export class SincronizadorTablas {
  private base: LecturaTablas | null = null;
  private ocupado = false;
  private otraVez = false;

  constructor(
    private readonly nube: NubeTablas,
    private readonly entorno: EntornoTablas,
  ) {}

  /** ¿Manda ya este motor? (Si las tablas están vacías, sigue mandando el documento.) */
  get activo(): boolean {
    return this.base !== null;
  }

  /** Lo que hay en tablas, visto como estado: sirve de punto de partida para calcular cambios. */
  private baseComoEstado(sobre: EstadoHogar): EstadoHogar {
    return this.base ? aplicarLecturaDeTablas(sobre, this.base) : sobre;
  }

  async iniciar(): Promise<"activo" | "sin-migrar"> {
    const lectura = await this.nube.leer();
    if (!hayHogarEnTablas(lectura)) return "sin-migrar";
    const local = this.entorno.leer();
    const nuevo = aplicarLecturaDeTablas(migrarIdsDePersonas(local, this.entorno.hogarId), lectura);
    if (camposDeTablas(nuevo) !== camposDeTablas(local))
      this.entorno.antesDeAdoptar?.(local, nuevo);
    this.base = lectura;
    this.entorno.escribir(nuevo);
    this.entorno.avisar("al-dia");
    return "activo";
  }

  /** Envía lo que este dispositivo ha cambiado desde la última vez. */
  async sincronizar(): Promise<void> {
    if (!this.base) return;
    if (this.ocupado) {
      this.otraVez = true;
      return;
    }
    this.ocupado = true;
    try {
      do {
        this.otraVez = false;
        await this.enviar();
      } while (this.otraVez);
    } finally {
      this.ocupado = false;
    }
  }

  private async enviar(): Promise<void> {
    if (!this.base) return;
    const actual = this.entorno.leer();
    const cambios = diferencias(this.baseComoEstado(actual), actual, this.entorno.hogarId);
    if (!cambios) return;
    this.entorno.avisar("guardando");
    try {
      await this.nube.aplicar(cambios);
      this.base = aplicarCambiosALectura(this.base, cambios);
      this.entorno.avisar("al-dia");
    } catch (e) {
      this.entorno.avisar(esErrorDeRed(e) ? "sin-conexion" : "error");
    }
  }

  /** Lee las tablas (cambio de otro dispositivo o vuelta a la app) y lo mezcla con lo propio. */
  async recibir(): Promise<void> {
    if (!this.base) return;
    let lectura: LecturaTablas;
    try {
      lectura = await this.nube.leer();
    } catch {
      return;
    }
    // Releer el estado DESPUÉS de esperar: pudo cambiar mientras llegaba la respuesta.
    const actual = this.entorno.leer();
    const propios = diferencias(this.baseComoEstado(actual), actual, this.entorno.hogarId);
    const mezcla = propios ? aplicarCambiosALectura(lectura, propios) : lectura;
    const nuevo = aplicarLecturaDeTablas(actual, mezcla);
    this.base = lectura;
    if (camposDeTablas(nuevo) !== camposDeTablas(actual)) this.entorno.escribir(nuevo);
    if (propios) void this.sincronizar();
  }
}

function esErrorDeRed(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return /fetch|network|failed to|conexi|timeout/i.test(m);
}
