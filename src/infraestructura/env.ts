import { z } from "zod";

/**
 * Variables de entorno públicas (llegan al navegador).
 *
 * Next.js solo incrusta en el cliente las variables `NEXT_PUBLIC_*` referenciadas de forma
 * literal (`process.env.NEXT_PUBLIC_X`), por eso se leen una a una y no con `process.env` entero.
 */
const esquemaEnvPublico = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "debe ser una URL válida" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_", {
    message: "debe ser una clave publishable (sb_publishable_…)",
  }),
});

export type EnvPublico = z.infer<typeof esquemaEnvPublico>;

/** Valida un conjunto de variables; lanza un error legible si falta alguna o es incorrecta. */
export function parsearEnvPublico(valores: Record<string, string | undefined>): EnvPublico {
  const resultado = esquemaEnvPublico.safeParse(valores);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración incompleta. Revisa .env.local (ver .env.example):\n${detalle}`);
  }
  return resultado.data;
}

let cache: EnvPublico | undefined;

/** Lectura perezosa: la build no falla si una página no necesita Supabase. */
export function envPublico(): EnvPublico {
  cache ??= parsearEnvPublico({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cache;
}

export type EstadoConfigNube = "ok" | "ausente" | "url-invalida" | "clave-invalida";

/**
 * ¿Está bien configurada la nube? Distingue «no hay variables» de «hay, pero con otra forma» (por
 * ejemplo la clave antigua `eyJ…` en vez de `sb_publishable_…`): así la app puede decir qué falla
 * en vez de parecer que la sincronización «no está activada» (D-084). Nunca devuelve los valores.
 */
export function diagnosticarEnvPublico(valores: {
  url: string | undefined;
  clave: string | undefined;
}): EstadoConfigNube {
  if (!valores.url && !valores.clave) return "ausente";
  if (!z.url().safeParse(valores.url ?? "").success) return "url-invalida";
  if (!(valores.clave ?? "").startsWith("sb_publishable_")) return "clave-invalida";
  return "ok";
}
