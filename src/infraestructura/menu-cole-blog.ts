import "server-only";
import { inflateRawSync } from "node:zlib";
import { z } from "zod";
import type { CentroConBlog, Visto } from "@/aplicacion/sincronizar-menu-cole";
import {
  HOST_NUBE,
  NOMBRE_MENU_BASAL,
  type EntradaBlog,
  entradasDelBlog,
  extraerDeZip,
} from "@/dominio/menu-cole-blog";

/** Lo que toca la red y la base de datos en la sincronización del menú del cole (D-173). */

const MAX_PDF = 10 * 1024 * 1024;
const NAVEGADOR = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
} as const;

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
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("supabase-no-responde");
  return r.json();
}

const centrosSchema = z.array(
  z.object({ centro: z.string().uuid(), fuente: z.string().url(), tokens: z.array(z.string()) }),
);
const vistosSchema = z.array(
  z.object({
    post: z.string(),
    resultado: z.string(),
    intentos: z.number().int(),
    vistoEn: z.string(),
  }),
);

export async function centrosConBlog(secreto: string): Promise<CentroConBlog[]> {
  const r = centrosSchema.safeParse(
    await rpc("centros_con_menu_automatico", { p_secreto: secreto }),
  );
  return r.success ? r.data : [];
}

export async function fuentesVistas(secreto: string, centro: string): Promise<Visto[]> {
  const r = vistosSchema.safeParse(
    await rpc("fuentes_menu_vistas", { p_secreto: secreto, p_centro: centro }),
  );
  return r.success ? r.data : [];
}

export async function registrarMenu(
  secreto: string,
  centro: string,
  post: string,
  resultado: string,
  dias?: unknown,
): Promise<string | null> {
  const r = await rpc("registrar_menu_cole_automatico", {
    p_secreto: secreto,
    p_centro: centro,
    p_post: post,
    p_resultado: resultado,
    p_dias: dias ?? null,
  });
  return typeof r === "string" ? r : null;
}

/** Las entradas del blog del colegio (feed JSON de Blogger). */
export async function leerEntradasDelBlog(fuente: string): Promise<EntradaBlog[]> {
  const r = await fetch(`${fuente}?alt=json&max-results=8`, {
    headers: NAVEGADOR,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`blog-${r.status}`);
  return entradasDelBlog(await r.json());
}

async function bajar(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, {
      headers: NAVEGADOR,
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const datos = Buffer.from(await r.arrayBuffer());
    return datos.length > 0 && datos.length <= MAX_PDF * 3 ? datos : null;
  } catch {
    return null;
  }
}

const esPdf = (b: Buffer | null): b is Buffer =>
  b !== null && b.length <= MAX_PDF && b.subarray(0, 5).toString("latin1") === "%PDF-";

/**
 * El PDF del menú «normal» de una carpeta compartida de la nube del colegio (educaMadrid, Nextcloud):
 * primero el archivo suelto y, si no, la carpeta entera en ZIP. En base64, o null.
 */
export async function bajarMenuBasal(carpeta: string): Promise<string | null> {
  if (!/^[A-Za-z0-9]{8,40}$/.test(carpeta)) return null;
  const base = `https://${HOST_NUBE}/s/${carpeta}/download`;
  const suelto = await bajar(`${base}?path=%2F&files=${encodeURIComponent(NOMBRE_MENU_BASAL)}`);
  if (esPdf(suelto)) return suelto.toString("base64");
  const zip = await bajar(base);
  if (!zip) return null;
  const pdf = extraerDeZip(zip, (n) => /(^|\/)men[uú]_basal\.pdf$/i.test(n), inflateRawSync);
  return esPdf(pdf) ? pdf.toString("base64") : null;
}
