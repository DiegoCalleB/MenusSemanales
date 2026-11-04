import "server-only";
import type { TipoArchivoCole } from "@/dominio/ia-cole";
import {
  INSTRUCCIONES_CIRCULAR,
  type ItemCircular,
  depurarCircular,
  mensajeParaCircular,
  respuestaCircularSchema,
} from "@/dominio/ia-circular";
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
          tipo: { type: "STRING", enum: ["cita", "tarea"] },
          titulo: { type: "STRING" },
          fecha: { type: "STRING" },
          hasta: { type: "STRING" },
          hora: { type: "STRING" },
        },
        required: ["tipo", "titulo", "fecha", "hasta", "hora"],
      },
    },
  },
  required: ["items"],
} as const;

export type EntradaCircular =
  | { hoy: FechaIso; texto: string; archivo?: undefined }
  | { hoy: FechaIso; archivo: { mime: TipoArchivoCole; base64: string }; texto?: undefined };

export function cuerpoDeCircular(e: EntradaCircular, conAjustes = true) {
  const partes: unknown[] = e.archivo
    ? [
        { inlineData: { mimeType: e.archivo.mime, data: e.archivo.base64 } },
        { text: mensajeParaCircular(e.hoy) },
      ]
    : [{ text: mensajeParaCircular(e.hoy, e.texto) }];
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_CIRCULAR }] },
    contents: [{ role: "user", parts: partes }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ESQUEMA,
      temperature: 0,
      maxOutputTokens: 6000,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

/** Lee una circular (texto, foto o PDF) y devuelve lo que hay que recordar. El archivo no se guarda. */
export async function leerCircular(
  e: EntradaCircular,
  llamar: typeof fetch = fetch,
): Promise<{ items: ItemCircular[]; pasados: number }> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoDeCircular(e), {
    sinAjustes: cuerpoDeCircular(e, false),
    plazoMs: 55_000,
    porIntentoMs: 30_000,
    llamar,
  });
  const texto = textoDeRespuestaGemini(await r.json());
  if (texto === null) return { items: [], pasados: 0 };
  try {
    const v = respuestaCircularSchema.safeParse(JSON.parse(texto));
    return v.success ? depurarCircular(v.data.items, e.hoy) : { items: [], pasados: 0 };
  } catch {
    return { items: [], pasados: 0 };
  }
}
