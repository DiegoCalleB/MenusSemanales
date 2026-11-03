import { peticionListaSchema } from "@/dominio/ia-lista";
import { comprobarAccesoIa, motivoDeError } from "@/infraestructura/ia/acceso";
import { IaNoConfigurada, ordenarLista } from "@/infraestructura/ia/lista";

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

  const acceso = await comprobarAccesoIa();
  if (!acceso.ok) return acceso.respuesta;
  const { usadas, limite } = acceso;

  try {
    const r = await ordenarLista(peticion.data);
    return responder(
      { articulos: r.articulos, usadas: usadas ?? null, limite: limite ?? null },
      200,
    );
  } catch (e) {
    // El proveedor no devuelve nada al cliente: solo un código corto (texto de la persona y respuesta quedan aquí).
    const motivo = motivoDeError(e);
    console.error("[ia] fallo", motivo);
    return responder(
      e instanceof IaNoConfigurada
        ? { error: "ia-no-configurada" }
        : { error: "no-disponible", motivo },
      502,
    );
  }
}
