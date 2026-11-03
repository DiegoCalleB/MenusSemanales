import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { NubeTablas } from "@/aplicacion/sincronizacion-tablas";
import {
  type CambiosRegistro,
  type LecturaRegistro,
  leerRegistro,
} from "@/aplicacion/tablas-registro";
import type { Database, Json } from "./database.types";

/** «Lo de hoy» del hogar, sobre Supabase (D-108): los últimos días de `registro_hogar`. */
export function crearNubeRegistro(
  cliente: SupabaseClient<Database>,
  hogarId: string,
): NubeTablas<LecturaRegistro, CambiosRegistro> & {
  suscribir: (alCambiar: () => void) => () => void;
} {
  return {
    async leer() {
      const { data, error } = await cliente.rpc("leer_registro_tablas", { p_hogar_id: hogarId });
      if (error) throw new Error(error.message);
      return leerRegistro(data);
    },
    async aplicar(cambios) {
      const { error } = await cliente.rpc("aplicar_cambios_registro", {
        p_hogar_id: hogarId,
        p_cambios: cambios as unknown as Json,
      });
      if (error) throw new Error(error.message);
    },
    /** Lo que apunta una persona aparece en el móvil de la otra. */
    suscribir(alCambiar) {
      const canal: RealtimeChannel = cliente.channel(`hogar-registro-${hogarId}`).on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registro_hogar",
          filter: `hogar_id=eq.${hogarId}`,
        },
        () => alCambiar(),
      );
      canal.subscribe();
      return () => {
        void cliente.removeChannel(canal);
      };
    },
  };
}
