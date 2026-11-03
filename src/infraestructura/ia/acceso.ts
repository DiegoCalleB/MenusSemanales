import "server-only";
import { crearClienteServidor } from "@/infraestructura/supabase/cliente-servidor";
import { hogarDelUsuario } from "@/infraestructura/supabase/cuenta";
import { iaConfigurada } from "./lista";

const CABECERAS = { "Cache-Control": "no-store", "Content-Type": "application/json" } as const;

export const responderIa = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: CABECERAS });

/**
 * Lo que toda llamada a la IA comprueba antes de gastar nada (D-098): que haya clave, sesión y
 * hogar, y que el hogar no haya llegado a su tope diario (que se cuenta en la base de datos).
 */
export async function comprobarAccesoIa(): Promise<
  { ok: true; usadas: number | null; limite: number | null } | { ok: false; respuesta: Response }
> {
  if (!iaConfigurada())
    return { ok: false, respuesta: responderIa({ error: "ia-no-configurada" }, 503) };
  const cliente = await crearClienteServidor();
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return { ok: false, respuesta: responderIa({ error: "sin-sesion" }, 401) };
  const hogar = await hogarDelUsuario(cliente);
  if (!hogar) return { ok: false, respuesta: responderIa({ error: "sin-hogar" }, 403) };
  const uso = await cliente.rpc("usar_ia", { p_hogar_id: hogar.id });
  if (uso.error) {
    return {
      ok: false,
      respuesta:
        uso.error.code === "53400"
          ? responderIa({ error: "tope-diario" }, 429)
          : responderIa({ error: "no-disponible" }, 502),
    };
  }
  const { usadas, limite } = (uso.data ?? {}) as { usadas?: number; limite?: number };
  return { ok: true, usadas: usadas ?? null, limite: limite ?? null };
}
