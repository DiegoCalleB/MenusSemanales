import { peticionListaSchema } from "@/dominio/ia-lista";
import { IaNoConfigurada, iaConfigurada, ordenarLista } from "@/infraestructura/ia/lista";
import { crearClienteServidor } from "@/infraestructura/supabase/cliente-servidor";
import { hogarDelUsuario } from "@/infraestructura/supabase/cuenta";

const CABECERAS = { "Cache-Control": "no-store", "Content-Type": "application/json" } as const;
const MAX_CUERPO = 20_000;

const responder = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: CABECERAS });

/**
 * Ordenar con IA lo que se escribe o dicta para la lista de la compra (D-098). Solo con sesión y
 * hogar; cuenta el uso del hogar en la base de datos (que decide el tope diario) antes de llamar a
 * la IA. No guarda ni registra el texto. Devuelve artículos propuestos: no toca la lista.
 */
export async function POST(request: Request) {
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) return responder({ error: "demasiado-grande" }, 413);

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return responder({ error: "peticion-invalida" }, 400);
  }
  const peticion = peticionListaSchema.safeParse(cuerpo);
  if (!peticion.success) return responder({ error: "peticion-invalida" }, 400);

  if (!iaConfigurada()) return responder({ error: "ia-no-configurada" }, 503);

  const cliente = await crearClienteServidor();
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return responder({ error: "sin-sesion" }, 401);
  const hogar = await hogarDelUsuario(cliente);
  if (!hogar) return responder({ error: "sin-hogar" }, 403);

  const uso = await cliente.rpc("usar_ia", { p_hogar_id: hogar.id });
  if (uso.error) {
    return uso.error.code === "53400"
      ? responder({ error: "tope-diario" }, 429)
      : responder({ error: "no-disponible" }, 502);
  }
  const { usadas, limite } = (uso.data ?? {}) as { usadas?: number; limite?: number };

  try {
    const r = await ordenarLista(peticion.data);
    return responder(
      { articulos: r.articulos, usadas: usadas ?? null, limite: limite ?? null },
      200,
    );
  } catch (e) {
    // Sin detalles: ni el texto de la persona ni el error del proveedor salen del servidor.
    return responder(
      { error: e instanceof IaNoConfigurada ? "ia-no-configurada" : "no-disponible" },
      502,
    );
  }
}
