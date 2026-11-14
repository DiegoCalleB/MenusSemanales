import "server-only";
import { direccionesDeAvisos } from "@/dominio/avisos";
import webpush from "web-push";

export interface SuscripcionPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const pushConfigurado = (): boolean =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

export const claveVapidPublica = (): string | null => process.env.VAPID_PUBLIC_KEY ?? null;

/** Un par de claves nuevo para estrenar las notificaciones. No se guarda en ningún sitio. */
export const generarClavesVapid = () => webpush.generateVAPIDKeys();

export type ResultadoPush = "ok" | "caducada" | "fallo";

/**
 * Manda una notificación a un móvil. «caducada» = el servicio de notificaciones dice que esa
 * dirección ya no existe (el móvil se desinstaló o quitó el permiso): hay que olvidarla.
 */
export async function enviarPush(
  sub: SuscripcionPush,
  /** `hecho`: el código del botón «Hecho» (D-151), si la notificación lo lleva. */
  mensaje: { titulo: string; cuerpo: string; hecho?: string },
  enviar: typeof webpush.sendNotification = webpush.sendNotification,
  /** Las claves guardadas en la base de datos (D-139); sin ellas, las de las variables. */
  claves?: { publica: string; privada: string } | null,
): Promise<ResultadoPush> {
  const publica = claves?.publica ?? process.env.VAPID_PUBLIC_KEY;
  const privada = claves?.privada ?? process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return "fallo";
  const sujeto =
    process.env.VAPID_SUBJECT?.trim() ||
    (direccionesDeAvisos(process.env.AVISOS_CORREO)[0]
      ? `mailto:${direccionesDeAvisos(process.env.AVISOS_CORREO)[0]}`
      : "mailto:avisos@example.com");
  try {
    await enviar(sub, JSON.stringify(mensaje), {
      vapidDetails: { subject: sujeto, publicKey: publica, privateKey: privada },
      TTL: 6 * 3600,
      urgency: "normal",
      timeout: 15_000,
    });
    return "ok";
  } catch (e) {
    const estado = (e as { statusCode?: number }).statusCode;
    return estado === 404 || estado === 410 ? "caducada" : "fallo";
  }
}
