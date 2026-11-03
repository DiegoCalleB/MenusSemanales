import type { EstadoHogar } from "./estado";
import type { EstadoSync } from "./sincronizacion";
import { type Adaptador, adaptadorHogar } from "./adaptadores-tablas";
import type { CambiosTablas, LecturaTablas } from "./tablas";

/**
 * Motor de sincronización por tablas (D-095, generalizado en D-101). Sustituye, agregado a
 * agregado, al documento: cada AGREGADO (personas y agenda del hogar; el menú; luego la compra…)
 * es un `Adaptador` que sabe leer sus tablas, calcular diferencias y mezclar cambios. El motor es
 * el mismo para todos.
 *
 * No lleva cola de acciones: guarda `base` (lo que sabe que hay en las tablas) y, al sincronizar,
 * calcula por identificador qué ha cambiado el estado respecto a esa base y envía solo eso. Si
 * falla la red, la próxima vez se vuelve a calcular y no se pierde nada. Cuando llegan cambios de
 * otro dispositivo se mezclan fila a fila con los propios aún sin enviar.
 */

export interface NubeTablas<L = LecturaTablas, C = CambiosTablas> {
  leer(): Promise<L>;
  aplicar(cambios: C): Promise<void>;
}

export interface EntornoTablas {
  hogarId: string;
  leer: () => EstadoHogar;
  escribir: (estado: EstadoHogar) => void;
  avisar: (estado: EstadoSync) => void;
  /** Justo antes de que las tablas sustituyan lo de este dispositivo. */
  antesDeAdoptar?: (local: EstadoHogar, nuevo: EstadoHogar) => void;
}

export class SincronizadorTablas<L = LecturaTablas, C = CambiosTablas> {
  private base: L | null = null;
  private ocupado = false;
  private otraVez = false;
  private readonly adaptador: Adaptador<L, C>;

  constructor(
    private readonly nube: NubeTablas<L, C>,
    private readonly entorno: EntornoTablas,
    adaptador?: Adaptador<L, C>,
  ) {
    // Sin adaptador, el de siempre: personas, agenda y demás del hogar (D-095).
    this.adaptador = adaptador ?? (adaptadorHogar(entorno.hogarId) as unknown as Adaptador<L, C>);
  }

  /** ¿Manda ya este motor? (Si las tablas están vacías, sigue mandando el documento.) */
  get activo(): boolean {
    return this.base !== null;
  }

  /** Lo que hay en tablas, visto como estado: sirve de punto de partida para calcular cambios. */
  private baseComoEstado(sobre: EstadoHogar): EstadoHogar {
    return this.base ? this.adaptador.aEstado(sobre, this.base) : sobre;
  }

  async iniciar(): Promise<"activo" | "sin-migrar"> {
    const lectura = await this.nube.leer();
    if (!this.adaptador.hayDatos(lectura)) return "sin-migrar";
    const local = this.entorno.leer();
    const nuevo = this.adaptador.aEstado(await this.adaptador.preparar(local), lectura);
    if (this.adaptador.huella(nuevo) !== this.adaptador.huella(local))
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
    let actual = this.entorno.leer();
    let cambios = this.adaptador.diferencias(this.baseComoEstado(actual), actual);
    if (!cambios) return;
    this.entorno.avisar("guardando");
    try {
      // Hay cosas que la base de datos no aceptaría tal cual (p. ej. un ingrediente nuevo que aún
      // no está en el catálogo): el adaptador las arregla y el estado local se actualiza.
      if (this.adaptador.antesDeEnviar) {
        const arreglado = await this.adaptador.antesDeEnviar(actual);
        if (arreglado) {
          this.entorno.escribir(arreglado);
          actual = arreglado;
          cambios = this.adaptador.diferencias(this.baseComoEstado(actual), actual);
          if (!cambios) {
            this.entorno.avisar("al-dia");
            return;
          }
        }
      }
      await this.nube.aplicar(cambios);
      this.base = this.adaptador.aplicarALectura(this.base, cambios);
      this.entorno.avisar("al-dia");
    } catch (e) {
      this.entorno.avisar(esErrorDeRed(e) ? "sin-conexion" : "error");
    }
  }

  /** Lee las tablas (cambio de otro dispositivo o vuelta a la app) y lo mezcla con lo propio. */
  async recibir(): Promise<void> {
    if (!this.base) return;
    let lectura: L;
    try {
      lectura = await this.nube.leer();
    } catch {
      return;
    }
    // Releer el estado DESPUÉS de esperar: pudo cambiar mientras llegaba la respuesta.
    const actual = this.entorno.leer();
    const propios = this.adaptador.diferencias(this.baseComoEstado(actual), actual);
    const mezcla = propios ? this.adaptador.aplicarALectura(lectura, propios) : lectura;
    const nuevo = this.adaptador.aEstado(actual, mezcla);
    this.base = lectura;
    if (this.adaptador.huella(nuevo) !== this.adaptador.huella(actual))
      this.entorno.escribir(nuevo);
    if (propios) void this.sincronizar();
  }
}

function esErrorDeRed(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return /fetch|network|failed to|conexi|timeout/i.test(m);
}
