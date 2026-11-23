import { z } from "zod";
import { MAX_CERRAR_POR_VEZ, MAX_CREAR_POR_VEZ, esIdDeTodoist } from "@/dominio/todoist";
import { crearClienteServidor } from "@/infraestructura/supabase/cliente-servidor";
import { hogarDelUsuario } from "@/infraestructura/supabase/cuenta";
import { TodoistError, sincronizarConTodoist } from "@/infraestructura/todoist";

const CABECERAS = { "Cache-Control": "no-store" } as const;
const responder = (cuerpo: unknown, status: number) =>
  Response.json(cuerpo, { status, headers: CABECERAS });

const MAX_CUERPO = 40_000;

const peticion = z.object({
  crear: z
    .array(z.object({ ref: z.string().min(1).max(80), content: z.string().min(1).max(600) }))
    .max(MAX_CREAR_POR_VEZ),
  cerrar: z.array(z.string().refine(esIdDeTodoist)).max(MAX_CERRAR_POR_VEZ),
});

/** Solo con sesión y hogar (como lo demás que gasta algo): el token de Todoist es del servidor. */
async function comprobarAcceso(): Promise<Response | null> {
  const cliente = await crearClienteServidor();
  const { data } = await cliente.auth.getUser();
  if (!data.user) return responder({ error: "sin-sesion" }, 401);
  if (!(await hogarDelUsuario(cliente))) return responder({ error: "sin-hogar" }, 403);
  return null;
}

const token = () => (process.env.TODOIST_TOKEN ?? "").trim();

/**
 * ¿Está configurado Todoist (D-205)? Con `TODOIST_TOKEN` en las variables de Railway y, si no es
 * Diego, `TODOIST_PERSONA_ID` con la persona de la familia a la que pertenece esa cuenta.
 */
export async function GET() {
  const fallo = await comprobarAcceso();
  if (fallo) return fallo;
  return responder(
    {
      configurado: token().length > 0,
      persona: (process.env.TODOIST_PERSONA_ID ?? "diego").trim() || "diego",
    },
    200,
  );
}

/**
 * Sincroniza: cierra y crea lo que se manda y devuelve las tareas abiertas del proyecto «¡Hecho!».
 * No guarda nada: la app decide qué hacer con la respuesta.
 */
export async function POST(request: Request) {
  const fallo = await comprobarAcceso();
  if (fallo) return fallo;
  if (!token()) return responder({ error: "no-configurado" }, 503);
  const crudo = await request.text();
  if (crudo.length > MAX_CUERPO) return responder({ error: "demasiado-grande" }, 413);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return responder({ error: "peticion-invalida" }, 400);
  }
  const p = peticion.safeParse(cuerpo);
  if (!p.success) return responder({ error: "peticion-invalida" }, 400);
  try {
    return responder(await sincronizarConTodoist(token(), p.data), 200);
  } catch (e) {
    const motivo = e instanceof TodoistError ? e.motivo : "red";
    console.error("[todoist]", motivo, e instanceof TodoistError ? (e.message ?? "") : "");
    return responder({ error: "no-disponible", motivo }, motivo === "token" ? 401 : 502);
  }
}
