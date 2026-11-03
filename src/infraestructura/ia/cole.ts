import "server-only";
import {
  INSTRUCCIONES_TRANSCRIPCION,
  type TipoArchivoCole,
  limpiarTranscripcion,
} from "@/dominio/ia-cole";
import { llamarGemini } from "./gemini";
import { IaNoConfigurada } from "./lista";

/**
 * Transcribir no necesita «pensar»: con el razonamiento del modelo por defecto la respuesta tarda
 * más de un minuto. Se pide poco razonamiento; si el modelo no admite el ajuste, se repite sin él.
 */
export function cuerpoDeTranscripcion(
  archivo: { mime: TipoArchivoCole; base64: string },
  conAjustes = true,
) {
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_TRANSCRIPCION }] },
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: archivo.mime, data: archivo.base64 } },
          { text: "Transcribe el menú de este documento." },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { texto: { type: "STRING" } },
        required: ["texto"],
      },
      temperature: 0,
      maxOutputTokens: 12000,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

/**
 * Pide a Gemini que transcriba el menú de un PDF o una foto (D-105). El archivo se envía en la
 * petición y no se guarda en ningún sitio. Devuelve el texto (vacío si no es un menú o no se lee).
 */
export async function transcribirMenuCole(
  archivo: { mime: TipoArchivoCole; base64: string },
  llamar: typeof fetch = fetch,
): Promise<string> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoDeTranscripcion(archivo), {
    sinAjustes: cuerpoDeTranscripcion(archivo, false),
    plazoMs: 55_000,
    llamar,
  });
  const cuerpo = (await r.json()) as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: unknown }> } }>;
  } | null;
  const candidato = cuerpo?.candidates?.[0];
  if (!candidato || candidato.finishReason === "SAFETY") return "";
  const bruto = (candidato.content?.parts ?? [])
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");
  try {
    const json = JSON.parse(bruto) as { texto?: unknown };
    return typeof json.texto === "string" ? limpiarTranscripcion(json.texto) : "";
  } catch {
    return "";
  }
}
