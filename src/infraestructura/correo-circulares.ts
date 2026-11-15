import "server-only";
import { z } from "zod";
import { type AdjuntoRecibido } from "@/dominio/correo-circular";
import { type ItemCircular, MAX_BYTES_CIRCULAR } from "@/dominio/ia-circular";

/**
 * Circulares por correo (D-147): leer de Resend el correo recibido (el aviso que manda Resend solo
 * trae su identificador; el contenido se pide aquí, con la clave del servidor) y guardar lo leído
 * en la base de datos con el código de la dirección del hogar.
 */

const API = "https://api.resend.com";

export class CorreoNoConfigurado extends Error {
  constructor() {
    super("Falta RESEND_API_KEY");
    this.name = "CorreoNoConfigurado";
  }
}

const cabeceras = () => {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) throw new CorreoNoConfigurado();
  return { Authorization: `Bearer ${clave}` };
};

const correoSchema = z.object({
  to: z.array(z.string()).catch([]),
  subject: z.string().nullish(),
  text: z.string().nullish(),
  html: z.string().nullish(),
});
export type CorreoRecibido = z.infer<typeof correoSchema>;

/** El correo recibido: a quién iba, el asunto y el texto. null si Resend no lo conoce. */
export async function leerCorreoRecibido(id: string): Promise<CorreoRecibido | null> {
  const r = await fetch(`${API}/emails/receiving/${encodeURIComponent(id)}`, {
    headers: cabeceras(),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`resend-${r.status}`);
  const p = correoSchema.safeParse(await r.json());
  return p.success ? p.data : null;
}

const adjuntosSchema = z.object({
  data: z
    .array(
      z.object({
        filename: z.string().nullish(),
        content_type: z.string().nullish(),
        size: z.number().nullish(),
        download_url: z.string().nullish(),
      }),
    )
    .catch([]),
});

/** Los adjuntos del correo (sin el contenido: con un enlace de descarga de una hora). */
export async function adjuntosDelCorreo(id: string): Promise<AdjuntoRecibido[]> {
  const r = await fetch(`${API}/emails/receiving/${encodeURIComponent(id)}/attachments`, {
    headers: cabeceras(),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) return [];
  const p = adjuntosSchema.safeParse(await r.json());
  return p.success ? p.data.data : [];
}

/** Baja un adjunto (PDF o foto) en base64. null si no es lo que dice o es demasiado grande. */
export async function bajarAdjunto(url: string, mime: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!r.ok) return null;
    const datos = Buffer.from(await r.arrayBuffer());
    if (datos.length === 0 || datos.length > MAX_BYTES_CIRCULAR) return null;
    if (mime === "application/pdf" && datos.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return null;
    }
    return datos.toString("base64");
  } catch {
    return null;
  }
}

/** Guarda lo leído para el hogar del código. 'guardada', 'repetida', 'demasiadas'… o null. */
export async function guardarCircularCorreo(
  codigo: string,
  emailId: string,
  asunto: string,
  items: readonly ItemCircular[],
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) throw new Error("supabase-no-configurado");
  const r = await fetch(`${url}/rest/v1/rpc/guardar_circular_correo`, {
    method: "POST",
    headers: { apikey: clave, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_codigo: codigo,
      p_email_id: emailId,
      p_asunto: asunto,
      p_items: items,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("supabase-no-responde");
  const v: unknown = await r.json();
  return typeof v === "string" ? v : null;
}
