import "server-only";
import { llamarGemini } from "./gemini";

export { MODELO_IA } from "./gemini";
import { CATEGORIAS } from "@/dominio/habituales";
import {
  INSTRUCCIONES_LISTA,
  type PeticionLista,
  type RespuestaLista,
  depurarArticulos,
  mensajeParaIa,
  respuestaListaSchema,
} from "@/dominio/ia-lista";

/** ¿Hay clave de la IA en este servidor? */
export const iaConfigurada = (): boolean => Boolean(process.env.GEMINI_API_KEY);

export class IaNoConfigurada extends Error {
  constructor() {
    super("La IA no está configurada");
    this.name = "IaNoConfigurada";
  }
}

/** Forma de la respuesta que pedimos (subconjunto de OpenAPI que entiende Gemini). */
const ESQUEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    articulos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING" },
          cantidad: { type: "STRING" },
          categoria: { type: "STRING", enum: [...CATEGORIAS] },
        },
        required: ["nombre", "cantidad", "categoria"],
      },
    },
  },
  required: ["articulos"],
} as const;

/** El cuerpo de la petición a `generateContent`. Exportado para poder comprobarlo en los tests. */
export function cuerpoDePeticion(peticion: PeticionLista) {
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_LISTA }] },
    contents: [{ role: "user", parts: [{ text: mensajeParaIa(peticion) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ESQUEMA_RESPUESTA,
      temperature: 0.2,
      maxOutputTokens: 4000,
    },
  };
}

/** El texto de la primera respuesta, o null si no hay (bloqueada, vacía o sin candidatos). */
function textoDeRespuesta(cuerpo: unknown): string | null {
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

/**
 * Pide a Gemini que ordene el texto en artículos de compra. La clave (`GEMINI_API_KEY`) solo existe
 * en el servidor y viaja en una cabecera, nunca en la URL. Lanza `IaNoConfigurada` si falta; el
 * resto de errores los trata la ruta sin enseñar detalles.
 */
export async function ordenarLista(
  peticion: PeticionLista,
  llamar: typeof fetch = fetch,
): Promise<RespuestaLista> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoDePeticion(peticion), {
    plazoMs: 25_000,
    llamar,
  });
  const texto = textoDeRespuesta(await r.json());
  if (texto === null) return { articulos: [] };
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { articulos: [] };
  }
  const valido = respuestaListaSchema.safeParse(json);
  return valido.success
    ? { articulos: depurarArticulos(valido.data.articulos, peticion.yaEnLista) }
    : { articulos: [] };
}
