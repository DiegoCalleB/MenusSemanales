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
      // Con «pensar mucho», lo que piensa cuenta en este límite: con poco, la respuesta sale cortada.
      maxOutputTokens: 32_000,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "high" } } : {}),
    },
  };
}

/**
 * Lee el calendario de los PDF (en base64). `null` si la IA no devuelve algo con la forma pedida;
 * entonces `porQue` recibe el motivo (para la prueba: «cortada», «json», «esquema: …»).
 */
export async function leerCalendarioEscolar(
  anio: number,
  pdfs: readonly string[],
  llamar: typeof fetch = fetch,
  porQue: (motivo: string) => void = () => {},
): Promise<CalendarioLeido | null> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoCalendarioEscolar(anio, pdfs), {
    sinAjustes: cuerpoCalendarioEscolar(anio, pdfs, false),
    plazoMs: 120_000,
    porIntentoMs: 90_000,
    llamar,
  });
  const cuerpo = (await r.json()) as { candidates?: Array<{ finishReason?: string }> } | null;
  const fin = cuerpo?.candidates?.[0]?.finishReason ?? "sin-candidatos";
  const texto = textoDeRespuestaGemini(cuerpo);
  if (texto === null) {
    porQue(`sin-texto (${fin})`);
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    porQue(`json (${fin}, ${texto.length} caracteres)`);
    return null;
  }
  const v = respuestaCalendarioEscolarSchema.safeParse(json);
  if (!v.success) {
    porQue(
      `esquema: ${v.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`.slice(0, 200),
    );
    return null;
  }
  return v.data;
}
