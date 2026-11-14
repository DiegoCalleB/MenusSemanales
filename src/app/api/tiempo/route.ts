import { leerPrevision } from "@/infraestructura/tiempo";

/**
 * La previsión del tiempo en Madrid para «Hoy» (D-145). Pública: es la misma para todos y no
 * dice nada del hogar. El navegador la pide aquí (no a Open-Meteo) para no abrir la CSP.
 */
export async function GET() {
  const dias = await leerPrevision();
  return new Response(JSON.stringify({ dias }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": dias.length > 0 ? "public, max-age=1800" : "no-store",
    },
  });
}
