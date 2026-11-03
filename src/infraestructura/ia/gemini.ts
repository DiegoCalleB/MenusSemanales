import "server-only";

/**
 * El modelo se cambia por variable de entorno sin tocar el código. `gemini-flash-latest` es el
 * alias de Google para «el Flash más reciente» (D-100); si se prefiere fijar una versión, se pone
 * aquí (p. ej. `gemini-2.5-flash`).
 */
export const MODELO_IA = process.env.IA_MODELO?.trim() || "gemini-flash-latest";
/**
 * Opcional: si el principal está saturado se prueba con este. Sin valor por defecto a propósito:
 * Google retira modelos con frecuencia y uno fijo en el código acabaría dando 404.
 */
export const MODELO_RESPALDO = process.env.IA_MODELO_RESPALDO?.trim() || "";

const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** Errores pasajeros del proveedor: merece la pena reintentar. */
const REINTENTABLES = new Set([429, 500, 502, 503, 504]);
const ESPERA_MS = 1200;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Llama a `generateContent` con reintentos: un 503 de Google («modelo saturado») suele durar
 * segundos, así que se reintenta una vez y, si sigue, se prueba con el de respaldo si hay uno configurado. Todo
 * dentro de un plazo total. Lanza `ia-http-<código>` con el último fallo.
 */
export async function llamarGemini(
  clave: string,
  cuerpo: unknown,
  opciones: { plazoMs: number; llamar?: typeof fetch; espera?: (ms: number) => Promise<unknown> },
): Promise<Response> {
  const llamar = opciones.llamar ?? fetch;
  const espera = opciones.espera ?? dormir;
  const limite = Date.now() + opciones.plazoMs;
  const modelos =
    MODELO_RESPALDO === "" || MODELO_IA === MODELO_RESPALDO
      ? [MODELO_IA]
      : [MODELO_IA, MODELO_RESPALDO];
  const intentos = modelos.flatMap((m) => [m, m]);
  let primero = 0;
  for (let i = 0; i < intentos.length; i++) {
    const restante = limite - Date.now();
    if (restante <= 0) break;
    const r = await llamar(
      `${URL_BASE}/${encodeURIComponent(intentos[i] as string)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(restante),
        cache: "no-store",
      },
    );
    if (r.ok) return r;
    primero ||= r.status; // el error del modelo principal es el que explica qué pasa
    if (!REINTENTABLES.has(r.status)) break;
    // Antes de repetir con el mismo modelo se espera un poco; al cambiar de modelo, no.
    if (intentos[i] === intentos[i + 1]) await espera(ESPERA_MS);
  }
  throw new Error(`ia-http-${primero || 504}`);
}
