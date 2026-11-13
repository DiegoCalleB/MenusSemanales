import "server-only";
import { z } from "zod";

/**
 * Las claves de las notificaciones guardadas en la base de datos (D-139). La pública la puede
 * pedir cualquiera; la privada solo quien presenta el secreto de la llamada programada (que crea
 * y guarda la propia base de datos). Todo con la clave pública de Supabase: nada de claves maestras.
 */
export interface ClavesVapid {
  publica: string;
  privada: string;
}

const SECRETO = /^[0-9a-f]{64}$/;
const respuesta = z
  .object({ publica: z.string().nullable(), privada: z.string().nullable() })
  .nullable();

function acceso() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && clave ? { url, clave } : null;
}

async function rpc(nombre: string, cuerpo: unknown): Promise<unknown> {
  const a = acceso();
  if (!a) throw new Error("supabase-no-configurado");
  const r = await fetch(`${a.url}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { apikey: a.clave, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("supabase-no-responde");
  return r.json();
}

export type ResultadoSecreto = { valido: false } | { valido: true; claves: ClavesVapid | null };

const aResultado = (v: unknown): ResultadoSecreto => {
  const p = respuesta.safeParse(v);
  if (!p.success || p.data === null) return { valido: false };
  const { publica, privada } = p.data;
  return { valido: true, claves: publica && privada ? { publica, privada } : null };
};

/** ¿Es el secreto de la llamada programada? Si lo es, con las claves (o null si aún no hay). */
export async function comprobarSecretoDeAvisos(secreto: string): Promise<ResultadoSecreto> {
  if (!SECRETO.test(secreto)) return { valido: false };
  return aResultado(await rpc("claves_de_avisos", { p_secreto: secreto }));
}

/** Guarda las claves la primera vez; devuelve las que quedan guardadas (si ya había, esas). */
export async function guardarClavesDeAvisos(
  secreto: string,
  claves: ClavesVapid,
): Promise<ClavesVapid | null> {
  const r = aResultado(
    await rpc("guardar_claves_de_avisos", {
      p_secreto: secreto,
      p_publica: claves.publica,
      p_privada: claves.privada,
    }),
  );
  return r.valido ? r.claves : null;
}

/** La clave pública guardada en la base de datos, o null si aún no hay. */
export async function clavePublicaDeAvisos(): Promise<string | null> {
  try {
    const v = await rpc("clave_publica_de_avisos", {});
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}
