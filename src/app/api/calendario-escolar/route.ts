import { leerCalendariosEscolares } from "@/infraestructura/calendario-escolar";

/**
 * Los cursos del calendario escolar leídos automáticamente (D-146) y la última comprobación.
 * Público: es el calendario oficial, igual para todos.
 */
export async function GET() {
  const c = await leerCalendariosEscolares();
  return Response.json(c, { headers: { "Cache-Control": "public, max-age=3600" } });
}
