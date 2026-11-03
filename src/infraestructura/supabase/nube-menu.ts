import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { ResolverIngredientes } from "@/aplicacion/adaptadores-tablas";
import type { NubeTablas } from "@/aplicacion/sincronizacion-tablas";
import { type CambiosMenu, type LecturaMenu, leerMenu } from "@/aplicacion/tablas-menu";
import type { Database, Json } from "./database.types";

type Cliente = SupabaseClient<Database>;

/** Tablas del menú en la publicación de Realtime (D-101). */
export const TABLAS_DEL_MENU_EN_DIRECTO = [
  "plato",
  "plato_ingrediente",
  "comida_planificada",
  "comida_plato",
  "nota_comida",
  "almuerzo",
  "valoracion_plato",
  "ingrediente_excluido",
] as const;

/** El menú del hogar sobre Supabase: lectura y escritura por las funciones SQL de D-101. */
export function crearNubeMenu(
  cliente: Cliente,
  hogarId: string,
): NubeTablas<LecturaMenu, CambiosMenu> & {
  suscribir: (alCambiar: () => void) => () => void;
  resolver: ResolverIngredientes;
} {
  return {
    async leer() {
      const { data, error } = await cliente.rpc("leer_menu_tablas", { p_hogar_id: hogarId });
      if (error) throw new Error(error.message);
      return leerMenu(data);
    },

    async aplicar(cambios) {
      const { error } = await cliente.rpc("aplicar_cambios_menu", {
        p_hogar_id: hogarId,
        p_cambios: cambios as unknown as Json,
      });
      if (error) throw new Error(error.message);
    },

    async resolver(ingredientes) {
      const { data, error } = await cliente.rpc("resolver_ingredientes", {
        p_ingredientes: ingredientes as unknown as Json,
      });
      if (error) throw new Error(error.message);
      return (data ?? {}) as Record<string, string>;
    },

    suscribir(alCambiar) {
      let canal: RealtimeChannel = cliente.channel(`hogar-menu-${hogarId}`);
      for (const tabla of TABLAS_DEL_MENU_EN_DIRECTO) {
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
