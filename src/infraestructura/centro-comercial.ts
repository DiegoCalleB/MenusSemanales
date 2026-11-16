import "server-only";
import type { PlanBarrio } from "@/dominio/barrio";
import {
  CATEGORIAS_CENTRO,
  DIAS_ATRAS_ENTRADAS,
  type EntradaCentro,
  INSTRUCCIONES_CENTRO,
  WEB_CENTRO,
  entradasDelCentro,
  mensajeCentro,
  planesDelCentro,
  respuestaCentroSchema,
} from "@/dominio/centro-comercial";
import { sumarDias } from "@/dominio/fechas";
import { llamarGemini, textoDeRespuestaGemini } from "./ia/gemini";

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    eventos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          entradaId: { type: "INTEGER" },
          titulo: { type: "STRING" },
          fechas: { type: "ARRAY", items: { type: "STRING" } },
          hora: { type: "STRING", nullable: true },
          gratis: { type: "BOOLEAN" },
          familiar: { type: "BOOLEAN" },
          tipo: { type: "STRING", enum: ["taller", "teatro", "juego", "otro"] },
        },
        required: ["entradaId", "titulo", "fechas", "gratis", "familiar", "tipo"],
      },
    },
  },
  required: ["eventos"],
} as const;

/** Lo leído por la IA, por conjunto de entradas (su id y última modificación): no se vuelve a pagar. */
const guardado = new Map<string, { en: number; planes: PlanBarrio[] }>();
const VALE_MS = 12 * 3600 * 1000;

/**
 * Los eventos del Centro Comercial Las Rosas (D-172): se leen las entradas de «Eventos» y
 * «Actividades infantiles» de su web y la IA saca los días. Si no hay clave de la IA, si la web o la
 * IA fallan o no devuelven algo válido, no hay planes del centro y todo lo demás sigue.
 */
export async function leerPlanesDelCentro(
  hoy: string,
  pedir: typeof fetch = fetch,
  informe: { centro?: string } = {},
): Promise<PlanBarrio[]> {
  try {
    const clave = process.env.GEMINI_API_KEY;
    if (!clave) {
      informe.centro = "sin-ia";
      return [];
    }
    const desde = sumarDias(hoy, -DIAS_ATRAS_ENTRADAS);
    const url = `${WEB_CENTRO}/wp-json/wp/v2/posts?categories=${CATEGORIAS_CENTRO.join(",")}&per_page=12&after=${desde}T00:00:00&_fields=id,date,modified,link,title,content`;
    const r = await pedir(url, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 6 * 3600 },
    } as RequestInit);
    if (!r.ok) throw new Error(`http-${r.status}`);
    const crudo = (await r.json()) as Array<{ id?: number; modified?: string }>;
    const entradas: EntradaCentro[] = entradasDelCentro(crudo);
    if (entradas.length === 0) {
      informe.centro = "ok: sin entradas";
      return [];
    }
    const llave = `${hoy}|${crudo.map((p) => `${p.id}:${p.modified ?? ""}`).join(",")}`;
    const previo = guardado.get(llave);
    if (previo && Date.now() - previo.en < VALE_MS) {
      informe.centro = `ok: ${previo.planes.length} planes (guardado)`;
      return previo.planes;
    }
    const g = await llamarGemini(
      clave,
      {
        systemInstruction: { parts: [{ text: INSTRUCCIONES_CENTRO }] },
        contents: [{ role: "user", parts: [{ text: mensajeCentro(entradas, hoy) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: ESQUEMA,
          temperature: 0,
          maxOutputTokens: 8000,
        },
      },
      { plazoMs: 25_000, porIntentoMs: 20_000 },
    );
    const texto = textoDeRespuestaGemini(await g.json());
    const leidos = respuestaCentroSchema.parse(JSON.parse(texto ?? "null"));
    const planes = planesDelCentro(leidos, entradas, hoy);
    guardado.set(llave, { en: Date.now(), planes });
    informe.centro = `ok: ${planes.length} planes`;
    return planes;
  } catch (e) {
    informe.centro = `error: ${e instanceof Error ? e.message.slice(0, 40) : "desconocido"}`;
    return [];
  }
}
