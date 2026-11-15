import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import { leerEventosEstadio } from "@/infraestructura/metropolitano";

/**
 * Partidos y conciertos en el Metropolitano (D-159), para el calendario de la app. Público: es
 * información pública y no dice nada del hogar.
 */
export async function GET() {
  const eventos = await leerEventosEstadio(hoyEnMadrid());
  return Response.json(
    { eventos },
    { headers: { "Cache-Control": eventos.length > 0 ? "public, max-age=3600" : "no-store" } },
  );
}
