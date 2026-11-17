import "server-only";
import {
  INSTRUCCIONES_PREGUNTAR,
  MAX_RESPUESTA,
  mensajeParaPreguntar,
} from "@/dominio/ia-preguntar";
import type { FechaIso } from "@/dominio/fechas";
import { llamarGemini, textoDeRespuestaGemini } from "./gemini";
import { IaNoConfigurada } from "./lista";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export interface EntradaPreguntar {
  hoy: FechaIso;
  pregunta: string;
  contexto: string;
}

export function cuerpoDePreguntar(e: EntradaPreguntar, conAjustes = true) {
  const dia = DIAS[new Date(`${e.hoy}T12:00:00Z`).getUTCDay()] ?? "";
  return {
    systemInstruction: { parts: [{ text: INSTRUCCIONES_PREGUNTAR }] },
    contents: [
      {
        role: "user",
        parts: [{ text: mensajeParaPreguntar(e.hoy, dia, e.contexto, e.pregunta) }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { respuesta: { type: "STRING" } },
        required: ["respuesta"],
      },
      temperature: 0.2,
      maxOutputTokens: 3000,
      ...(conAjustes ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

/** Contesta una pregunta con el resumen que manda el móvil (D-179). Nada se guarda. */
export async function preguntarALaCasa(
  e: EntradaPreguntar,
  llamar: typeof fetch = fetch,
): Promise<string> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new IaNoConfigurada();
  const r = await llamarGemini(clave, cuerpoDePreguntar(e), {
    sinAjustes: cuerpoDePreguntar(e, false),
    plazoMs: 40_000,
    porIntentoMs: 25_000,
    llamar,
  });
  const texto = textoDeRespuestaGemini(await r.json());
  if (texto === null) return "";
  try {
    const j = JSON.parse(texto) as { respuesta?: unknown };
    return typeof j.respuesta === "string" ? j.respuesta.trim().slice(0, MAX_RESPUESTA) : "";
  } catch {
    return "";
  }
}
