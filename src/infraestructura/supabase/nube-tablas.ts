import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { NubeTablas } from "@/aplicacion/sincronizacion-tablas";
import { type CambiosTablas, leerTablas } from "@/aplicacion/tablas";
import type { Database, Json } from "./database.types";

type Cliente = SupabaseClient<Database>;

/** Tablas del hogar que viven en la publicación de Realtime (ver D-095). */
export const TABLAS_EN_DIRECTO = [
  "persona",
  "hogar_ajuste",
  "dia_hogar",
  "cumple",
  "cumple_regalo",
  "cumple_idea",
  "apunte",
  "fecha_senalada",
  "tarea_casa",
  "tarea_persona",
  "tarea_persona_hecha",
] as const;

/** Las tablas del hogar sobre Supabase: lectura y escritura por las dos funciones SQL (D-088). */
export function crearNubeTablas(
  cliente: Cliente,
  hogarId: string,
): NubeTablas & { suscribir: (alCambiar: () => void) => () => void } {
  return {
    async leer() {
      const { data, error } = await cliente.rpc("leer_hogar_tablas", { p_hogar_id: hogarId });
      if (error) throw new Error(error.message);
      return leerTablas(data);
    },

    async aplicar(cambios: CambiosTablas) {
      const { error } = await cliente.rpc("aplicar_cambios_tablas", {
        p_hogar_id: hogarId,
        p_cambios: cambios as unknown as Json,
      });
      if (error) throw new Error(error.message);
    },

    suscribir(alCambiar) {
      let canal: RealtimeChannel = cliente.channel(`hogar-tablas-${hogarId}`);
      for (const tabla of TABLAS_EN_DIRECTO) {
        canal = canal.on(
          "postgres_changes",
          { event: "*", schema: "public", table: tabla, filter: `hogar_id=eq.${hogarId}` },
          () => alCambiar(),
        );
      }
      canal.subscribe();
      return () => {
        void cliente.removeChannel(canal);
      };
    },
  };
}
