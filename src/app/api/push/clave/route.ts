import { clavePublicaDeAvisos } from "@/infraestructura/avisos/claves";
import { claveVapidPublica } from "@/infraestructura/avisos/push";

/** Siempre se calcula en cada petición: la clave se lee de las variables de Railway, no del momento de la compilación. */
export const dynamic = "force-dynamic";

/**
 * La clave pública de las notificaciones (no es secreta): la de las variables de Railway o, si no
 * hay, la que guardó la base de datos (D-139). 404 si aún no hay ninguna.
 */
export async function GET() {
  const clave = claveVapidPublica() ?? (await clavePublicaDeAvisos());
  return clave
    ? Response.json({ clave }, { headers: { "Cache-Control": "no-store" } })
    : Response.json(
        { error: "no-configurado" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
}
