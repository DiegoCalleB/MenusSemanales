import { esMiembroConToken, tokenDeLaPeticion } from "@/infraestructura/acceso-miembro";
import { generarClavesVapid } from "@/infraestructura/avisos/push";

const SIN_CACHE = { "Cache-Control": "no-store" } as const;

/**
 * Un par de claves nuevo para estrenar las notificaciones: se enseña UNA vez a quien lo pide (con
 * sesión) para que lo ponga en las variables de Railway. No se guarda ni se registra en ningún
 * sitio; cada llamada crea un par distinto.
 */
export async function POST(request: Request) {
  const token = tokenDeLaPeticion(request);
  if (!token || !(await esMiembroConToken(token))) {
    return Response.json({ error: "sin-permiso" }, { status: 401, headers: SIN_CACHE });
  }
  const { publicKey, privateKey } = generarClavesVapid();
  return Response.json({ publica: publicKey, privada: privateKey }, { headers: SIN_CACHE });
}
