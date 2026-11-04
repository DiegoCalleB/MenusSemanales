import { z } from "zod";
import { esMiembroConToken, tokenDeLaPeticion } from "@/infraestructura/acceso-miembro";
import { enviarPush, pushConfigurado } from "@/infraestructura/avisos/push";

const SIN_CACHE = { "Cache-Control": "no-store" } as const;
const cuerpoSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

/** Manda una notificación de prueba al móvil que la pide (con sesión), para comprobar que llega. */
export async function POST(request: Request) {
  const token = tokenDeLaPeticion(request);
  if (!token || !(await esMiembroConToken(token))) {
    return Response.json({ error: "sin-permiso" }, { status: 401, headers: SIN_CACHE });
  }
  if (!pushConfigurado()) {
    return Response.json({ error: "no-configurado" }, { status: 503, headers: SIN_CACHE });
  }
  const cuerpo = cuerpoSchema.safeParse(await request.json().catch(() => null));
  if (!cuerpo.success) {
    return Response.json({ error: "peticion-invalida" }, { status: 400, headers: SIN_CACHE });
  }
  const r = await enviarPush(cuerpo.data, {
    titulo: "Notificaciones activadas 🎉",
    cuerpo: "Así te llegarán los avisos de cada mañana.",
  });
  return Response.json(
    r === "ok" ? { ok: true } : { error: r === "caducada" ? "caducada" : "no-disponible" },
    { status: r === "ok" ? 200 : r === "caducada" ? 410 : 502, headers: SIN_CACHE },
  );
}
