import { MAX_BYTES_CIRCULAR, MAX_TEXTO_CIRCULAR } from "@/dominio/ia-circular";
import { esTipoValido } from "@/dominio/ia-cole";
import { comprobarAccesoIa, motivoDeError, responderIa } from "@/infraestructura/ia/acceso";
import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import { type EntradaCircular, leerCircular } from "@/infraestructura/ia/circular";
import { IaNoConfigurada } from "@/infraestructura/ia/lista";

/**
 * Leer una circular o nota del cole con IA (D-116): foto, PDF o texto pegado → citas y tareas.
 * Solo con sesión y hogar y dentro del tope diario. No guarda ni el archivo ni el resultado: la
 * persona revisa la lista y elige qué apuntar.
 */
export async function POST(request: Request) {
  let datos: FormData;
  try {
    datos = await request.formData();
  } catch {
    return responderIa({ error: "peticion-invalida" }, 400);
  }
  const hoy = hoyEnMadrid();
  const archivo = datos.get("archivo");
  const texto = datos.get("texto");
  let entrada: EntradaCircular;
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > MAX_BYTES_CIRCULAR) return responderIa({ error: "demasiado-grande" }, 413);
    if (!esTipoValido(archivo.type)) return responderIa({ error: "tipo-no-valido" }, 415);
    const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64");
    entrada = { hoy, archivo: { mime: archivo.type, base64 } };
  } else if (typeof texto === "string" && texto.trim().length >= 5) {
    entrada = { hoy, texto: texto.trim().slice(0, MAX_TEXTO_CIRCULAR) };
  } else {
    return responderIa({ error: "peticion-invalida" }, 400);
  }

  const acceso = await comprobarAccesoIa();
  if (!acceso.ok) return acceso.respuesta;

  try {
    const r = await leerCircular(entrada);
    return responderIa({ ...r, usadas: acceso.usadas, limite: acceso.limite }, 200);
  } catch (e) {
    const motivo = motivoDeError(e);
    console.error("[ia] circular", motivo);
    return responderIa(
      e instanceof IaNoConfigurada
        ? { error: "ia-no-configurada" }
        : { error: "no-disponible", motivo },
      502,
    );
  }
}
