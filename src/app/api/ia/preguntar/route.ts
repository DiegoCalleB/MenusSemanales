import { MAX_CONTEXTO, MAX_PREGUNTA, preguntaValida } from "@/dominio/ia-preguntar";
import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import { comprobarAccesoIa, motivoDeError, responderIa } from "@/infraestructura/ia/acceso";
import { IaNoConfigurada } from "@/infraestructura/ia/lista";
import { preguntarALaCasa } from "@/infraestructura/ia/preguntar";

const MAX_CUERPO = MAX_CONTEXTO + MAX_PREGUNTA + 2_000;

/**
 * «Pregúntale a tu casa» (D-179): una pregunta y un resumen de lo apuntado (que prepara el móvil, sin
 * medicación ni regalos) → una respuesta. Solo con sesión y hogar y dentro del tope diario de IA; no
 * guarda ni la pregunta ni el resumen ni la respuesta.
 */
export async function POST(request: Request) {
  const crudo = await request.text();
  if (crudo.length > MAX_CUERPO) return responderIa({ error: "demasiado-grande" }, 413);
  let cuerpo: { pregunta?: unknown; contexto?: unknown };
  try {
    cuerpo = JSON.parse(crudo) as typeof cuerpo;
  } catch {
    return responderIa({ error: "peticion-invalida" }, 400);
  }
  const pregunta = typeof cuerpo.pregunta === "string" ? cuerpo.pregunta.trim() : "";
  const contexto = typeof cuerpo.contexto === "string" ? cuerpo.contexto : "";
  if (!preguntaValida(pregunta) || contexto.length > MAX_CONTEXTO) {
    return responderIa({ error: "peticion-invalida" }, 400);
  }

  const acceso = await comprobarAccesoIa();
  if (!acceso.ok) return acceso.respuesta;

  try {
    const respuesta = await preguntarALaCasa({ hoy: hoyEnMadrid(), pregunta, contexto });
    return responderIa({ respuesta, usadas: acceso.usadas, limite: acceso.limite }, 200);
  } catch (e) {
    const motivo = motivoDeError(e);
    console.error("[ia] preguntar", motivo);
    return responderIa(
      e instanceof IaNoConfigurada
        ? { error: "ia-no-configurada" }
        : { error: "no-disponible", motivo },
      502,
    );
  }
}
