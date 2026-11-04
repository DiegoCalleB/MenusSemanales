import "server-only";

/**
 * El modelo se cambia por variable de entorno sin tocar el código. `gemini-flash-latest` es el
 * alias de Google para «el Flash más reciente» (D-100); si se prefiere fijar una versión, se pone
 * aquí (p. ej. `gemini-2.5-flash`).
 */
export const MODELO_IA = process.env.IA_MODELO?.trim() || "gemini-flash-latest";
/**
 * Si el principal está saturado (503) se prueba con este. Es el alias «Flash-Lite más reciente»
 * de Google: al ser un alias, no se queda obsoleto cuando retiran una versión. Se puede cambiar
 * con `IA_MODELO_RESPALDO` (o poner `ninguno` para desactivarlo).
 */
export const MODELO_RESPALDO = process.env.IA_MODELO_RESPALDO?.trim() || "gemini-flash-lite-latest";

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
  opciones: {
    plazoMs: number;
    /** Tiempo máximo de cada intento: si un modelo no contesta, se pasa al siguiente. */
    porIntentoMs?: number;
    sinAjustes?: unknown;
    llamar?: typeof fetch;
    espera?: (ms: number) => Promise<unknown>;
  },
): Promise<Response> {
  const llamar = opciones.llamar ?? fetch;
  const espera = opciones.espera ?? dormir;
  const limite = Date.now() + opciones.plazoMs;
  const modelos =
    MODELO_RESPALDO === "ninguno" || MODELO_IA === MODELO_RESPALDO
      ? [MODELO_IA]
      : [MODELO_IA, MODELO_RESPALDO];
  let primero = ""; // el fallo del modelo principal es el que explica qué pasa
  // Si el modelo rechaza algún ajuste opcional (400), se repite ese intento con el cuerpo simple.
  let cuerpoActual = cuerpo;
  for (const modelo of modelos) {
    for (let intento = 0; intento < 2; intento++) {
      const restante = limite - Date.now();
      if (restante <= 0) throw new Error(primero || "ia-tiempo");
      let r: Response;
      try {
        r = await llamar(`${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
          body: JSON.stringify(cuerpoActual),
          signal: AbortSignal.timeout(Math.min(restante, opciones.porIntentoMs ?? restante)),
          cache: "no-store",
        });
      } catch (e) {
        if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
          primero ||= "ia-tiempo";
          break; // no contesta: no se insiste con este modelo
        }
        throw e;
      }
      if (r.ok) return r;
      primero ||= `ia-http-${r.status}`;
      if (
        r.status === 400 &&
        opciones.sinAjustes !== undefined &&
        cuerpoActual !== opciones.sinAjustes
      ) {
        cuerpoActual = opciones.sinAjustes;
        intento--; // mismo modelo, cuerpo simple
        continue;
      }
      if (!REINTENTABLES.has(r.status)) throw new Error(primero);
      if (intento === 0) await espera(ESPERA_MS);
    }
  }
  throw new Error(primero || "ia-red");
}

/** El texto de la primera respuesta, o null si no hay (bloqueada, vacía o sin candidatos). */
export function textoDeRespuestaGemini(cuerpo: unknown): string | null {
  const c = cuerpo as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: unknown }> } }>;
  } | null;
  const candidato = c?.candidates?.[0];
  if (!candidato || candidato.finishReason === "SAFETY") return null;
  const texto = (candidato.content?.parts ?? [])
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");
  return texto.trim() === "" ? null : texto;
}
