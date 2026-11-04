import "server-only";

export interface CorreoParaEnviar {
  /** Una o varias direcciones. */
  para: string[];
  asunto: string;
  texto: string;
  html: string;
  /** Misma clave = mismo correo: Resend no lo envía dos veces en 24 h aunque se pida dos veces. */
  clave: string;
}

export class CorreoNoConfigurado extends Error {
  constructor() {
    super("El correo no está configurado");
    this.name = "CorreoNoConfigurado";
  }
}

/** Remitente por defecto: el de pruebas de Resend, que solo escribe al dueño de la cuenta de Resend. */
const REMITENTE_DE_PRUEBA = "Menús Semanales <onboarding@resend.dev>";

/**
 * Envía un correo con Resend (D-114). La clave (`RESEND_API_KEY`) solo existe en el servidor y va
 * en una cabecera. Lanza `ia-…`-style sin detalles: ni el contenido ni la respuesta salen de aquí.
 */
export async function enviarCorreo(
  c: CorreoParaEnviar,
  llamar: typeof fetch = fetch,
): Promise<void> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) throw new CorreoNoConfigurado();
  const r = await llamar("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
      "Idempotency-Key": c.clave,
    },
    body: JSON.stringify({
      from: process.env.AVISOS_DE?.trim() || REMITENTE_DE_PRUEBA,
      to: c.para,
      subject: c.asunto,
      text: c.texto,
      html: c.html,
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`correo-http-${r.status}`);
}
