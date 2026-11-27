import { type FechaIso } from "@/dominio/fechas";
import { cuerpoDeRecordatorio } from "@/dominio/recordatorio";

/** Los servidores de Alexa a los que se puede llamar con el permiso de recordatorios. */
const SERVIDOR_VALIDO = /^https:\/\/api\.(eu\.|fe\.)?amazonalexa\.com$/;

export type ResultadoRecordatorio = "ok" | "sin-permiso" | "fallo";

/**
 * Pone un recordatorio de Alexa (D-216): el Echo lo dice en voz alta a esa hora. Usa el permiso que
 * la persona dio a la skill. «sin-permiso» = hay que pedírselo (tarjeta en la app de Alexa).
 */
export async function ponerRecordatorio(
  acceso: { token: string; endpoint: string },
  e: { texto: string; fecha: FechaIso; hora: string },
  ahora: Date = new Date(),
  pedir: typeof fetch = fetch,
): Promise<ResultadoRecordatorio> {
  // El servidor viene en la petición firmada por Amazon, pero no se llama a cualquiera con su token.
  if (!SERVIDOR_VALIDO.test(acceso.endpoint.replace(/\/$/, ""))) return "fallo";
  try {
    const r = await pedir(`${acceso.endpoint.replace(/\/$/, "")}/v1/alerts/reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${acceso.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeRecordatorio(e.texto, e.fecha, e.hora, ahora)),
      signal: AbortSignal.timeout(3500),
    });
    if (r.status === 201 || r.status === 200) return "ok";
    if (r.status === 401 || r.status === 403) return "sin-permiso";
    return "fallo";
  } catch {
    return "fallo";
  }
}
