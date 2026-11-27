/**
 * Apunta un producto en la compra del hogar a petición de Alexa (D-214). Usa solo la clave pública
 * y el token del calendario: la función de la base de datos comprueba el token, limpia el texto y
 * pone el tope diario. Devuelve 'ok', 'no-valido', 'demasiadas' o null (token que no vale); lanza si
 * Supabase no responde.
 */
export async function anadirCompraDesdeAlexa(token: string, texto: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) throw new Error("supabase-no-configurado");
  const r = await fetch(`${url}/rest/v1/rpc/alexa_anadir_compra`, {
    method: "POST",
    headers: { apikey: clave, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_texto: texto }),
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("supabase-no-responde");
  const v: unknown = await r.json();
  return typeof v === "string" ? v : null;
}

async function rpc(nombre: string, cuerpo: unknown): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) throw new Error("supabase-no-configurado");
  const r = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { apikey: clave, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("supabase-no-responde");
  return r.json();
}

/**
 * Guarda en la cola del hogar lo que pide Conchi (D-215): compra, pendiente, cita (con día y, si se
 * dijo, hora) o tarea de casa hecha. 'ok', 'no-valido', 'demasiadas' o null (token que no vale).
 */
export async function anadirEntradaAlexa(
  token: string,
  e: { tipo: string; texto: string; fecha: string | null; hora: string | null },
): Promise<string | null> {
  const v = await rpc("alexa_anadir", {
    p_token: token,
    p_tipo: e.tipo,
    p_texto: e.texto,
    p_fecha: e.fecha,
    p_hora: e.hora,
  });
  return typeof v === "string" ? v : null;
}

/** Una llamada de IA de Conchi, con el tope diario del hogar: 'ok', 'tope' o null (token que no vale). */
export async function usarIaAlexa(token: string): Promise<string | null> {
  const v = await rpc("alexa_usar_ia", { p_token: token });
  return typeof v === "string" ? v : null;
}

/** «Borra lo último» (D-216): lo que se quitó ({tipo, texto}), o null si no había nada (o el token no vale). */
export async function deshacerLoUltimoDeAlexa(
  token: string,
): Promise<{ tipo: string; texto: string } | null> {
  const v = await rpc("alexa_deshacer", { p_token: token });
  if (typeof v !== "object" || v === null) return null;
  const { tipo, texto } = v as { tipo?: unknown; texto?: unknown };
  return typeof tipo === "string" && typeof texto === "string" ? { tipo, texto } : null;
}

/** Lo que hay apuntado a mano en la compra y sin comprar; null si el token no vale. */
export async function leerCompraDeAlexa(token: string): Promise<string[] | null> {
  const v = await rpc("alexa_compra", { p_token: token });
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
}

/** Avisa a los móviles de la familia de lo que ha apuntado Conchi (con tope de una cada 15 s). */
export async function avisarALaFamilia(token: string, texto: string): Promise<boolean> {
  return (await rpc("alexa_avisar", { p_token: token, p_texto: texto })) === true;
}

/** Quién habla: asocia una voz de Alexa con una persona de la familia. 'ok', 'no-valido', 'demasiadas' o null. */
export async function vincularVozDeAlexa(
  token: string,
  voz: string,
  persona: string,
): Promise<string | null> {
  const v = await rpc("alexa_vincular_voz", { p_token: token, p_voz: voz, p_persona: persona });
  return typeof v === "string" ? v : null;
}

/** La persona de una voz ya vinculada, o null. */
export async function personaDeLaVoz(token: string, voz: string): Promise<string | null> {
  const v = await rpc("alexa_voz_persona", { p_token: token, p_voz: voz });
  return typeof v === "string" ? v : null;
}
