import { envPublico } from "./env";

/** Lo que Supabase cuenta de su propia configuración de acceso (público, sin claves). */
export interface AjustesAuth {
  /** «Entrar sin correo» activado. null si Supabase no lo dice. */
  anonimos: boolean | null;
  /** Entrar con correo (código de 6 cifras) activado. */
  correo: boolean | null;
  /** Se pueden crear cuentas nuevas. */
  registroAbierto: boolean | null;
}

const booleano = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** Interpreta la respuesta de `/auth/v1/settings` sin fiarse de su forma. null si no se entiende. */
export function interpretarAjustesAuth(dato: unknown): AjustesAuth | null {
  if (typeof dato !== "object" || dato === null) return null;
  const d = dato as Record<string, unknown>;
  const externo =
    typeof d.external === "object" && d.external !== null
      ? (d.external as Record<string, unknown>)
      : null;
  if (!externo) return null;
  const cerrado = booleano(d.disable_signup);
  return {
    anonimos: booleano(externo.anonymous_users),
    correo: booleano(externo.email),
    registroAbierto: cerrado === null ? null : !cerrado,
  };
}

/** Pregunta a Supabase por sus ajustes de acceso (endpoint público). null si no responde. */
export async function leerAjustesAuth(): Promise<AjustesAuth | null> {
  try {
    const env = envPublico();
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(6000),
    });
    return r.ok ? interpretarAjustesAuth(await r.json()) : null;
  } catch {
    return null;
  }
}
