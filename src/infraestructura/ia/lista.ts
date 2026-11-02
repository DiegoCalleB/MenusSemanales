import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  INSTRUCCIONES_LISTA,
  type PeticionLista,
  type RespuestaLista,
  depurarArticulos,
  mensajeParaIa,
  respuestaListaSchema,
} from "@/dominio/ia-lista";

/** El modelo se puede cambiar por variable de entorno sin tocar el código (coste/calidad). */
export const MODELO_IA = process.env.IA_MODELO?.trim() || "claude-opus-5-5";

/** ¿Hay clave de la IA en este servidor? */
export const iaConfigurada = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

export class IaNoConfigurada extends Error {
  constructor() {
    super("La IA no está configurada");
    this.name = "IaNoConfigurada";
  }
}

export interface ClienteIa {
  messages: {
    parse: Anthropic["messages"]["parse"];
  };
}

/**
 * Pide a Claude que ordene el texto en artículos de compra. La clave (`ANTHROPIC_API_KEY`) solo
 * existe en el servidor. Lanza `IaNoConfigurada` si falta; el resto de errores los trata la ruta.
 */
export async function ordenarLista(
  peticion: PeticionLista,
  cliente?: ClienteIa,
): Promise<RespuestaLista> {
  if (!cliente && !iaConfigurada()) throw new IaNoConfigurada();
  const claude: ClienteIa = cliente ?? new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const r = await claude.messages.parse({
    model: MODELO_IA,
    max_tokens: 4000,
    system: INSTRUCCIONES_LISTA,
    messages: [{ role: "user", content: mensajeParaIa(peticion) }],
    output_config: { effort: "low", format: zodOutputFormat(respuestaListaSchema) },
  });
  if (r.stop_reason === "refusal" || !r.parsed_output) return { articulos: [] };
  return { articulos: depurarArticulos(r.parsed_output.articulos, peticion.yaEnLista) };
}
