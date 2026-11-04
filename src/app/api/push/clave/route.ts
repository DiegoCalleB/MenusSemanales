import { claveVapidPublica } from "@/infraestructura/avisos/push";

/** Siempre se calcula en cada petición: la clave se lee de las variables de Railway, no del momento de la compilación. */
export const dynamic = "force-dynamic";

/** La clave pública de las notificaciones (no es secreta). 404 si aún no está configurado. */
export function GET() {
  const clave = claveVapidPublica();
  return clave
    ? Response.json({ clave }, { headers: { "Cache-Control": "no-store" } })
    : Response.json(
        { error: "no-configurado" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
}
