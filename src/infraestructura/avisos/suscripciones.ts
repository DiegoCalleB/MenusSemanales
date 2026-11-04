import "server-only";
import { z } from "zod";

const esquema = z.array(
  z.object({ endpoint: z.string().url(), p256dh: z.string(), auth: z.string() }),
);

function acceso() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && clave ? { url, clave } : null;
}

/** Los móviles que han activado las notificaciones en el hogar de un token de calendario. */
export async function leerSuscripciones(token: string) {
  const a = acceso();
  if (!a) return [];
  const r = await fetch(`${a.url}/rest/v1/rpc/suscripciones_para_avisos`, {
    method: "POST",
    headers: { apikey: a.clave, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("supabase-no-responde");
  const v = esquema.safeParse(await r.json());
  return v.success ? v.data : [];
}

/** Olvida una suscripción que el servicio de notificaciones dio por caducada. */
export async function olvidarSuscripcion(token: string, endpoint: string): Promise<void> {
  const a = acceso();
  if (!a) return;
  await fetch(`${a.url}/rest/v1/rpc/olvidar_suscripcion_push`, {
    method: "POST",
    headers: { apikey: a.clave, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_endpoint: endpoint }),
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  }).catch(() => undefined);
}
