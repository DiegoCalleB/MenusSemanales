import { adjuntoParaLeer, codigoDeDireccion, textoDelCorreo } from "@/dominio/correo-circular";
import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import {
  CorreoNoConfigurado,
  adjuntosDelCorreo,
  bajarAdjunto,
  guardarCircularCorreo,
  leerCorreoRecibido,
} from "@/infraestructura/correo-circulares";
import { type EntradaCircular, leerCircular } from "@/infraestructura/ia/circular";

export const maxDuration = 120;

const responder = (cuerpo: unknown, status: number) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Llega una circular por correo (D-147). Resend avisa aquí de cada correo recibido; el aviso solo
 * trae su identificador y se cree solo lo que devuelve Resend con la clave del servidor (un aviso
 * falso no puede colar nada). Si va a la dirección de un hogar, se lee el adjunto (o el texto) con
 * IA y se guarda pendiente de revisar: la familia elige qué apuntar. Lo demás se ignora.
 */
export async function POST(request: Request) {
  let emailId = "";
  try {
    const c = (await request.json()) as { type?: unknown; data?: { email_id?: unknown } };
    if (c?.type !== "email.received") return responder({ ignorado: "tipo" }, 200);
    emailId = typeof c.data?.email_id === "string" ? c.data.email_id : "";
  } catch {
    return responder({ error: "no-valido" }, 400);
  }
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(emailId)) return responder({ error: "no-valido" }, 400);

  try {
    const correo = await leerCorreoRecibido(emailId);
    if (!correo) return responder({ ignorado: "no-existe" }, 200);
    const codigo = codigoDeDireccion(correo.to);
    if (!codigo) return responder({ ignorado: "otra-direccion" }, 200);

    const hoy = hoyEnMadrid();
    const adjunto = adjuntoParaLeer(await adjuntosDelCorreo(emailId));
    const base64 = adjunto ? await bajarAdjunto(adjunto.url, adjunto.mime) : null;
    const texto = textoDelCorreo(correo);
    let entrada: EntradaCircular | null = null;
    if (adjunto && base64) entrada = { hoy, archivo: { mime: adjunto.mime, base64 } };
    else if (texto.length >= 5) entrada = { hoy, texto };
    const items = entrada ? (await leerCircular(entrada)).items : [];

    const asunto = (correo.subject ?? "").replace(/^\s*((re|fw|fwd|rv)\s*:\s*)+/i, "").trim();
    const r = await guardarCircularCorreo(codigo, emailId, asunto, items);
    return responder({ resultado: r ?? "codigo-desconocido", cosas: items.length }, 200);
  } catch (e) {
    if (e instanceof CorreoNoConfigurado) return responder({ error: "no-configurado" }, 503);
    console.error("[circulares] correo", e instanceof Error ? e.message : "desconocido");
    // 502: Resend lo reintentará más tarde.
    return responder({ error: "no-disponible" }, 502);
  }
}
