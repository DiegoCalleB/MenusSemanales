import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import { leerEventosEstadio } from "@/infraestructura/metropolitano";

/**
 * Partidos y conciertos en el Metropolitano (D-159), para el calendario de la app. Público: es
 * información pública y no dice nada del hogar.
 */
export async function GET() {
  const informe: { ticketmaster?: string } = {};
  const eventos = await leerEventosEstadio(hoyEnMadrid(), fetch, informe);
  return Response.json(
    // `fuentes` dice cómo ha ido cada fuente (nunca la clave), para saber por qué falta algo.
    { eventos, fuentes: { ticketmaster: informe.ticketmaster ?? "?" } },
    { headers: { "Cache-Control": eventos.length > 0 ? "public, max-age=3600" : "no-store" } },
  );
}
