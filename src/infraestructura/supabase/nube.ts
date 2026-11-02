import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { type EstadoHogar } from "@/aplicacion/estado";
import { ConflictoVersion, type EstadoRemoto, type Nube } from "@/aplicacion/sincronizacion";
import { esEstadoValido } from "@/infraestructura/almacen-local";
import type { Database, Json } from "./database.types";

type Cliente = SupabaseClient<Database>;

/** El estado guardado no tiene la forma que esta versión de la app espera. */
export class EstadoIncompatible extends Error {
  constructor() {
    super("El hogar tiene datos de otra versión de la app: actualiza la página.");
    this.name = "EstadoIncompatible";
  }
}

function aEstado(valor: unknown): EstadoHogar {
  // El estado viene de la nube: se comprueba su forma antes de usarlo.
  if (!esEstadoValido(valor)) throw new EstadoIncompatible();
  return valor;
}

/** Nube de un hogar sobre Supabase: lectura, guardado con versión y cambios en directo. */
export function crearNube(
  cliente: Cliente,
  hogarId: string,
): Nube & {
  suscribir: (alCambiar: (r: EstadoRemoto) => void) => () => void;
} {
  return {
    async leer() {
      const { data, error } = await cliente
        .from("hogar_estado")
        .select("estado, version")
        .eq("hogar_id", hogarId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { estado: aEstado(data.estado), version: Number(data.version) } : null;
    },

    async guardar(estado, versionEsperada) {
      const { data, error } = await cliente.rpc("guardar_estado_hogar", {
        p_hogar_id: hogarId,
        p_version_esperada: versionEsperada,
        p_estado: estado as unknown as Json,
      });
      if (error) {
        if (error.code === "40001") throw new ConflictoVersion();
        throw new Error(error.message);
      }
      return Number(data);
    },

    suscribir(alCambiar) {
      const canal: RealtimeChannel = cliente
        .channel(`hogar-estado-${hogarId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "hogar_estado", filter: `hogar_id=eq.${hogarId}` },
          (cambio) => {
            const nuevo = cambio.new as { estado?: unknown; version?: unknown };
            if (nuevo?.estado === undefined || nuevo.version === undefined) return;
            try {
              alCambiar({ estado: aEstado(nuevo.estado), version: Number(nuevo.version) });
            } catch {
              // Datos de otra versión: se ignoran; el siguiente guardado lo resolverá.
            }
          },
        )
        .subscribe();
      return () => {
        void cliente.removeChannel(canal);
      };
    },
  };
}
