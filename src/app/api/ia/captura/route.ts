import { MAX_TEXTO_CAPTURA, MIN_TEXTO_CAPTURA } from "@/dominio/ia-captura";
import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import { comprobarAccesoIa, motivoDeError, responderIa } from "@/infraestructura/ia/acceso";
import { leerCaptura } from "@/infraestructura/ia/captura";
import { IaNoConfigurada } from "@/infraestructura/ia/lista";

const MAX_CUERPO = 12_000;

/**
 * Una sola caja para apuntarlo todo (D-178): el texto escrito o dictado se reparte con IA en compra,
 * citas, pendientes y papeles. Solo con sesión y hogar y dentro del tope diario; no guarda ni el
 * texto ni el resultado: la persona revisa la lista y elige qué apuntar.
 */
export async function POST(request: Request) {
  const crudo = await request.text();
  if (crudo.length > MAX_CUERPO) return responderIa({ error: "demasiado-grande" }, 413);
  let cuerpo: { texto?: unknown; personas?: unknown };
  try {
    cuerpo = JSON.parse(crudo) as typeof cuerpo;
  } catch {
    return responderIa({ error: "peticion-invalida" }, 400);
  }
  const texto = typeof cuerpo.texto === "string" ? cuerpo.texto.trim() : "";
  if (texto.length < MIN_TEXTO_CAPTURA || texto.length > MAX_TEXTO_CAPTURA) {
    return responderIa({ error: "peticion-invalida" }, 400);
  }
  const personas = (Array.isArray(cuerpo.personas) ? cuerpo.personas : [])
    .filter((p): p is string => typeof p === "string" && p.trim() !== "" && p.length <= 60)
    .slice(0, 12);

  const acceso = await comprobarAccesoIa();
  if (!acceso.ok) return acceso.respuesta;

  try {
    const r = await leerCaptura({ hoy: hoyEnMadrid(), texto, personas });
    return responderIa({ ...r, usadas: acceso.usadas, limite: acceso.limite }, 200);
  } catch (e) {
    const motivo = motivoDeError(e);
    console.error("[ia] captura", motivo);
    return responderIa(
      e instanceof IaNoConfigurada
        ? { error: "ia-no-configurada" }
        : { error: "no-disponible", motivo },
      502,
    );
  }
}
