/**
 * ¿Quien llama es miembro de un hogar? Se lo preguntamos a Supabase con su propia sesión (el token
 * que manda la app en la cabecera): la RLS decide. Sin token, o con uno que Supabase no reconoce,
 * es que no.
 */
export async function esMiembroConToken(token: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return false;
  try {
    const r = await fetch(`${url}/rest/v1/miembro?select=hogar_id&limit=1`, {
      headers: { apikey: clave, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!r.ok) return false;
    const filas: unknown = await r.json();
    return Array.isArray(filas) && filas.length > 0;
  } catch {
    return false;
  }
}

/** El token de «Authorization: Bearer …», si lo hay. */
export const tokenDeLaPeticion = (request: Request): string | undefined =>
  /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
