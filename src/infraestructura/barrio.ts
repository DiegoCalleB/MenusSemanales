import "server-only";
import { FUENTE_BARRIO, type PlanBarrio, planesDelBarrio } from "@/dominio/barrio";

/**
 * La agenda cultural abierta del Ayuntamiento de Madrid, de San Blas-Canillejas (D-165). Se mira
 * cada 12 horas (la agenda cambia poco). Si falla, no hay planes del barrio y todo lo demás sigue.
 */
export async function leerPlanesDelBarrio(
  hoy: string,
  pedir: typeof fetch = fetch,
  /** Cómo ha ido, sin datos secretos: «ok: 35 planes» o «error: http-503». */
  informe: { barrio?: string } = {},
): Promise<PlanBarrio[]> {
  try {
    const r = await pedir(FUENTE_BARRIO, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 12 * 3600 },
    } as RequestInit);
    if (!r.ok) throw new Error(`http-${r.status}`);
    // El Ayuntamiento manda el JSON con una marca de orden de bytes al principio.
    const texto = (await r.text()).replace(/^﻿/, "");
    const planes = planesDelBarrio(JSON.parse(texto), hoy);
    informe.barrio = `ok: ${planes.length} planes`;
    return planes;
  } catch (e) {
    informe.barrio = `error: ${e instanceof Error ? e.message.slice(0, 40) : "desconocido"}`;
    return [];
  }
}
