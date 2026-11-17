import "server-only";
import {
  INSTRUCCIONES_CAPTURA,
  type ItemCaptura,
  depurarCaptura,
  mensajeParaCaptura,
  respuestaCapturaSchema,
} from "@/dominio/ia-captura";
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
          tipo: { type: "STRING", enum: ["compra", "evento", "pendiente", "papel"] },
          titulo: { type: "STRING" },
          fecha: { type: "STRING" },
          hasta: { type: "STRING" },
          hora: { type: "STRING" },
          persona: { type: "STRING" },
          importante: { type: "BOOLEAN" },
          repiteMeses: { type: "INTEGER" },
          categoria: { type: "STRING" },
        },
        required: [
          "tipo",
          "titulo",
          "fecha",
          "hasta",
          "hora",
          "persona",
          "importante",
          "repiteMeses",
          "categoria",
        ],
      },
    },
  },
  required: ["items"],
} as const;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export interface EntradaCaptura {
  hoy: FechaIso;
  texto: string;
  personas: readonly string[];
}

export function cuerpoDeCaptura(e: EntradaCaptura, conAjustes = true) {
  const dia = DIAS[new Date(`${e.hoy}T12:00:00Z`).getUTCDay()] ?? "";
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_CAPTURA }] },
    contents: [
      { role: "user", parts: [{ text: mensajeParaCaptura(e.hoy, dia, e.texto, e.personas) }] },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ESQUEMA,
      temperature: 0,
      maxOutputTokens: 6000,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

/** Reparte una nota escrita o dictada en compra, citas, pendientes y papeles (D-178). No se guarda. */
export async function leerCaptura(
  e: EntradaCaptura,
  llamar: typeof fetch = fetch,
): Promise<{ items: ItemCaptura[]; pasados: number }> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoDeCaptura(e), {
    sinAjustes: cuerpoDeCaptura(e, false),
    plazoMs: 45_000,
    porIntentoMs: 25_000,
    llamar,
  });
  const texto = textoDeRespuestaGemini(await r.json());
  if (texto === null) return { items: [], pasados: 0 };
  try {
    const v = respuestaCapturaSchema.safeParse(JSON.parse(texto));
    return v.success ? depurarCaptura(v.data.items, e.hoy) : { items: [], pasados: 0 };
  } catch {
    return { items: [], pasados: 0 };
  }
}
