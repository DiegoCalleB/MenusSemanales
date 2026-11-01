/**
 * Comprobación de salud para Railway. No expone versiones, configuración ni datos.
 */
export function GET() {
  return Response.json({ estado: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
