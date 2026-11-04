import "server-only";
import {
  INSTRUCCIONES_PLATO,
  type PeticionPlato,
  type PropuestaPlato,
  mensajeParaPlato,
  propuestaPlatoSchema,
} from "@/dominio/ia-plato";
import { GRUPOS_PLATO } from "@/dominio/menu";
import { SECCIONES } from "@/dominio/tipos";
import { llamarGemini, textoDeRespuestaGemini } from "./gemini";
import { IaNoConfigurada } from "./lista";

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    grupo: { type: "STRING", enum: [...GRUPOS_PLATO] },
    minutosActivos: { type: "INTEGER" },
    ligero: { type: "BOOLEAN" },
    pasos: { type: "STRING" },
    ingredientes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING" },
          cantidad: { type: "NUMBER" },
          unidad: { type: "STRING", enum: ["g", "ml", "ud"] },
          seccion: { type: "STRING", enum: [...SECCIONES] },
          opcional: { type: "BOOLEAN" },
        },
        required: ["nombre", "cantidad", "unidad", "seccion", "opcional"],
      },
    },
  },
  required: ["grupo", "minutosActivos", "ligero", "pasos", "ingredientes"],
} as const;

/** El cuerpo de la petición a `generateContent`. Exportado para comprobarlo en los tests. */
export function cuerpoDePlato(p: PeticionPlato, conAjustes = true) {
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_PLATO }] },
    contents: [{ role: "user", parts: [{ text: mensajeParaPlato(p) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ESQUEMA,
      temperature: 0.3,
      maxOutputTokens: 3000,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

/** Pide a Gemini los ingredientes, el tiempo y los pasos de un plato. null si no devuelve algo válido. */
export async function proponerPlato(
  p: PeticionPlato,
  llamar: typeof fetch = fetch,
): Promise<PropuestaPlato | null> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoDePlato(p), {
    sinAjustes: cuerpoDePlato(p, false),
    plazoMs: 30_000,
    porIntentoMs: 18_000,
    llamar,
  });
  const texto = textoDeRespuestaGemini(await r.json());
  if (texto === null) return null;
  try {
    const v = propuestaPlatoSchema.safeParse(JSON.parse(texto));
    return v.success ? v.data : null;
  } catch {
    return null;
  }
}
