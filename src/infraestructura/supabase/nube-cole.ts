import type { SupabaseClient } from "@supabase/supabase-js";
import type { NubeTablas } from "@/aplicacion/sincronizacion-tablas";
import { type CambiosCole, type LecturaCole, leerCole } from "@/aplicacion/tablas-cole";
import type { Database, Json } from "./database.types";

/**
 * El menú del cole del colegio del hogar, sobre Supabase (D-104). No hay actualización en directo:
 * la tabla no lleva el hogar (es del colegio) y el menú cambia poco; se refresca al volver a la app.
 */
export function crearNubeCole(
  cliente: SupabaseClient<Database>,
  hogarId: string,
): NubeTablas<LecturaCole, CambiosCole> {
  return {
    async leer() {
      const { data, error } = await cliente.rpc("leer_cole_tablas", { p_hogar_id: hogarId });
      if (error) throw new Error(error.message);
      return leerCole(data);
    },
    async aplicar(cambios) {
      const { error } = await cliente.rpc("aplicar_cambios_cole", {
        p_hogar_id: hogarId,
        p_cambios: cambios as unknown as Json,
      });
      if (error) throw new Error(error.message);
    },
  };
}
