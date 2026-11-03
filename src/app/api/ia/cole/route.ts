import { MAX_BYTES_ARCHIVO_COLE, esTipoValido } from "@/dominio/ia-cole";
import { comprobarAccesoIa, responderIa } from "@/infraestructura/ia/acceso";
import { transcribirMenuCole } from "@/infraestructura/ia/cole";
import { IaNoConfigurada } from "@/infraestructura/ia/lista";

/**
 * Subir el PDF o una foto del menú del cole y devolver su texto transcrito (D-105). Solo con sesión
 * y hogar y dentro del tope diario. No guarda el archivo ni el texto: la persona revisa la
 * transcripción en pantalla y es ella quien la lee y la guarda.
 */
export async function POST(request: Request) {
  let datos: FormData;
  try {
    datos = await request.formData();
  } catch {
    return responderIa({ error: "peticion-invalida" }, 400);
  }
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return responderIa({ error: "peticion-invalida" }, 400);
  }
  if (archivo.size > MAX_BYTES_ARCHIVO_COLE) return responderIa({ error: "demasiado-grande" }, 413);
  if (!esTipoValido(archivo.type)) return responderIa({ error: "tipo-no-valido" }, 415);

  const acceso = await comprobarAccesoIa();
  if (!acceso.ok) return acceso.respuesta;

  try {
    const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64");
    const texto = await transcribirMenuCole({ mime: archivo.type, base64 });
    return responderIa({ texto, usadas: acceso.usadas, limite: acceso.limite }, 200);
  } catch (e) {
    // Sin detalles: ni el contenido del archivo ni el error del proveedor salen del servidor.
    return responderIa(
      { error: e instanceof IaNoConfigurada ? "ia-no-configurada" : "no-disponible" },
      502,
    );
  }
}
