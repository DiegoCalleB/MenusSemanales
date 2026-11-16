import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import { leerPlanesDelBarrio } from "@/infraestructura/barrio";

/**
 * Los planes del barrio (San Blas-Canillejas, D-165), para la app. Público: es la agenda abierta del
 * Ayuntamiento y no dice nada del hogar.
 */
export async function GET() {
  const informe: { barrio?: string; centro?: string } = {};
  const planes = await leerPlanesDelBarrio(hoyEnMadrid(), fetch, informe);
  return Response.json(
    { planes, fuente: informe.barrio ?? "?", centro: informe.centro ?? "?" },
    { headers: { "Cache-Control": planes.length > 0 ? "public, max-age=3600" : "no-store" } },
  );
}
