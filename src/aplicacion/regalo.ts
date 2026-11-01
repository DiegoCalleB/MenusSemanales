import { z } from "zod";

/**
 * Regalo personal en un enlace. El mensaje viaja en el FRAGMENTO de la URL (lo que va tras «#»):
 * el navegador nunca lo envía al servidor, así que no queda en ningún registro ni se guarda en
 * ninguna parte. Quien tiene el enlace lo abre; el contenido se muestra siempre como texto.
 */

export const regaloSchema = z.object({
  /** Para quién es. */
  p: z.string().trim().min(1).max(40),
  /** De quién. */
  d: z.string().trim().min(1).max(40),
  /** Mensaje. */
  m: z.string().max(600),
});
export type Regalo = z.infer<typeof regaloSchema>;

const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f]/g;
const limpiar = (t: string) => t.replace(CONTROL, "");

export function codificarRegalo(regalo: Regalo): string {
  const limpio = regaloSchema.parse({
    p: limpiar(regalo.p),
    d: limpiar(regalo.d),
    m: limpiar(regalo.m),
  });
  const bytes = new TextEncoder().encode(JSON.stringify(limpio));
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lee el regalo de un fragmento («#p=…» o solo el valor). Devuelve null si no es válido. */
export function decodificarRegalo(fragmento: string): Regalo | null {
  try {
    const valor = fragmento.replace(/^#/, "").replace(/^p=/, "");
    if (valor === "" || valor.length > 4000 || !/^[A-Za-z0-9_-]+$/.test(valor)) return null;
    const base64 = valor.replace(/-/g, "+").replace(/_/g, "/");
    const binario = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const r = regaloSchema.safeParse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    if (!r.success) return null;
    return { p: limpiar(r.data.p), d: limpiar(r.data.d), m: limpiar(r.data.m) };
  } catch {
    return null;
  }
}

export const enlaceDeRegalo = (origen: string, regalo: Regalo): string =>
  `${origen}/regalo#p=${codificarRegalo(regalo)}`;
