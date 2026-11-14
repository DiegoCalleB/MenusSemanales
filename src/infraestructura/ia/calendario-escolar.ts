import "server-only";
import type { CalendarioLeido } from "@/dominio/calendario-escolar";
import {
  INSTRUCCIONES_CALENDARIO_ESCOLAR,
  mensajeCalendarioEscolar,
  respuestaCalendarioEscolarSchema,
} from "@/dominio/ia-calendario-escolar";
import { llamarGemini, textoDeRespuestaGemini } from "./gemini";
import { IaNoConfigurada } from "./lista";

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    inicio: { type: "STRING" },
    fin: { type: "STRING" },
    periodos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          desde: { type: "STRING" },
          hasta: { type: "STRING" },
          motivo: { type: "STRING" },
        },
        required: ["desde", "hasta", "motivo"],
      },
    },
    dias: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { fecha: { type: "STRING" }, motivo: { type: "STRING" } },
        required: ["fecha", "motivo"],
      },
    },
  },
  required: ["inicio", "fin", "periodos", "dias"],
} as const;

export function cuerpoCalendarioEscolar(anio: number, pdfs: readonly string[], conAjustes = true) {
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_CALENDARIO_ESCOLAR }] },
    contents: [
      {
        role: "user",
        parts: [
          ...pdfs.map((data) => ({ inlineData: { mimeType: "application/pdf", data } })),
          { text: mensajeCalendarioEscolar(anio) },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ESQUEMA,
      temperature: 0,
      maxOutputTokens: 6000,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "high" } } : {}),
    },
  };
}

/** Lee el calendario de los PDF (en base64). `null` si la IA no devuelve algo con la forma pedida. */
export async function leerCalendarioEscolar(
  anio: number,
  pdfs: readonly string[],
  llamar: typeof fetch = fetch,
): Promise<CalendarioLeido | null> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoCalendarioEscolar(anio, pdfs), {
    sinAjustes: cuerpoCalendarioEscolar(anio, pdfs, false),
    plazoMs: 120_000,
    porIntentoMs: 90_000,
    llamar,
  });
  const texto = textoDeRespuestaGemini(await r.json());
  if (texto === null) return null;
  try {
    const v = respuestaCalendarioEscolarSchema.safeParse(JSON.parse(texto));
    return v.success ? v.data : null;
  } catch {
    return null;
  }
}
