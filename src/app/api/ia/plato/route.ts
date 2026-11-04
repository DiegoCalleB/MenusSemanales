import { peticionPlatoSchema } from "@/dominio/ia-plato";
import { comprobarAccesoIa, motivoDeError, responderIa } from "@/infraestructura/ia/acceso";
import { IaNoConfigurada } from "@/infraestructura/ia/lista";
import { proponerPlato } from "@/infraestructura/ia/plato";

/**
 * Completar un plato con IA (D-116): del nombre salen ingredientes, tiempo y pasos. Solo con
 * sesión y hogar y dentro del tope diario. No guarda nada: la persona revisa la propuesta en el
 * formulario del plato y es ella quien la guarda.
 */
export async function POST(request: Request) {
  const cuerpo = peticionPlatoSchema.safeParse(await request.json().catch(() => null));
  if (!cuerpo.success) return responderIa({ error: "peticion-invalida" }, 400);

  const acceso = await comprobarAccesoIa();
  if (!acceso.ok) return acceso.respuesta;

  try {
    const propuesta = await proponerPlato(cuerpo.data);
    return responderIa({ propuesta, usadas: acceso.usadas, limite: acceso.limite }, 200);
  } catch (e) {
    const motivo = motivoDeError(e);
    console.error("[ia] plato", motivo);
    return responderIa(
      e instanceof IaNoConfigurada
        ? { error: "ia-no-configurada" }
        : { error: "no-disponible", motivo },
      502,
    );
  }
}
