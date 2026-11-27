import "server-only";
import {
  INSTRUCCIONES_CONCHI,
  INSTRUCCIONES_PREGUNTA,
  type ItemConchi,
  depurarFrase,
  mensajeParaConchi,
  respuestaConchiSchema,
} from "@/dominio/ia-conchi";
import type { FechaIso } from "@/dominio/fechas";
import { llamarGemini, textoDeRespuestaGemini } from "./gemini";
import { IaNoConfigurada } from "./lista";

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tipo: { type: "STRING", enum: ["compra", "pendiente", "cita", "recordatorio"] },
          titulo: { type: "STRING" },
          fecha: { type: "STRING" },
          hora: { type: "STRING" },
          ambigua: { type: "BOOLEAN" },
        },
        required: ["tipo", "titulo", "fecha", "hora", "ambigua"],
      },
    },
  },
  required: ["items"],
} as const;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Alexa corta a los 8 segundos: la IA tiene menos que eso. */
export const PLAZOS_VOZ = { plazoMs: 5500, porIntentoMs: 5000 } as const;

export interface EntradaFrase {
  hoy: FechaIso;
  /** «18:30», hora de Madrid. */
  hora: string;
  texto: string;
  personas: readonly string[];
}

export function cuerpoDeFrase(e: EntradaFrase, conAjustes = true) {
  const dia = DIAS[new Date(`${e.hoy}T12:00:00Z`).getUTCDay()] ?? "";
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_CONCHI }] },
    contents: [
      {
        role: "user",
        parts: [{ text: mensajeParaConchi(e.hoy, dia, e.hora, e.texto, e.personas) }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ESQUEMA,
      temperature: 0,
      maxOutputTokens: 2000,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

/** Reparte lo dicho en compra, pendientes, citas y recordatorios con hora (D-216). No se guarda. */
export async function leerFrase(
  e: EntradaFrase,
  llamar: typeof fetch = fetch,
  plazos: { plazoMs: number; porIntentoMs: number } = PLAZOS_VOZ,
): Promise<ItemConchi[]> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoDeFrase(e), {
    sinAjustes: cuerpoDeFrase(e, false),
    plazoMs: plazos.plazoMs,
    porIntentoMs: plazos.porIntentoMs,
    llamar,
  });
  const texto = textoDeRespuestaGemini(await r.json());
  if (texto === null) return [];
  try {
    const v = respuestaConchiSchema.safeParse(JSON.parse(texto));
    return v.success ? depurarFrase(v.data.items, e.hoy) : [];
  } catch {
    return [];
  }
}

export interface EntradaPregunta {
  hoy: FechaIso;
  pregunta: string;
  /** Los datos de la casa, en texto (`datosParaPreguntar`). */
  datos: string;
}

export function cuerpoDePregunta(e: EntradaPregunta, conAjustes = true) {
  const dia = DIAS[new Date(`${e.hoy}T12:00:00Z`).getUTCDay()] ?? "";
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_PREGUNTA }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Hoy es ${dia} ${e.hoy}.\n\nDatos de la casa:\n<datos>\n${e.datos}\n</datos>\n\nPregunta (entre las marcas):\n<pregunta>\n${e.pregunta}\n</pregunta>`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 400,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

/** Contesta una pregunta con los datos de la casa, en una o dos frases habladas. null si no hay respuesta. */
export async function contestarPregunta(
  e: EntradaPregunta,
  llamar: typeof fetch = fetch,
  plazos: { plazoMs: number; porIntentoMs: number } = PLAZOS_VOZ,
): Promise<string | null> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoDePregunta(e), {
    sinAjustes: cuerpoDePregunta(e, false),
    plazoMs: plazos.plazoMs,
    porIntentoMs: plazos.porIntentoMs,
    llamar,
  });
  const texto = textoDeRespuestaGemini(await r.json());
  // Una respuesta hablada: sin saltos de línea, markdown ni emojis, y de tamaño razonable.
  const limpio = (texto ?? "")
    .replace(/[*_`#>]+/g, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim()
    .slice(0, 400);
  return limpio === "" ? null : limpio;
}
