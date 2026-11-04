import { esMiembroConToken, tokenDeLaPeticion } from "@/infraestructura/acceso-miembro";
import { eventosDelCalendario, enlaceConfigurado } from "@/infraestructura/calendario-externo";

const SIN_CACHE = { "Cache-Control": "no-store" } as const;

/**
 * Eventos del Google Calendar «Familia» (D-074). Solo para miembros de un hogar: el enlace secreto
 * da acceso a todo el calendario, así que esta ruta nunca responde a quien no haya iniciado sesión.
 */
export async function GET(request: Request) {
  const token = tokenDeLaPeticion(request);
  if (!token || !(await esMiembroConToken(token))) {
    return Response.json({ estado: "sin-permiso" }, { status: 401, headers: SIN_CACHE });
  }
  if (!enlaceConfigurado()) {
    return Response.json({ estado: "no-configurado", eventos: [] }, { headers: SIN_CACHE });
  }
  const hoy = new URL(request.url).searchParams.get("hoy") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy)) {
    return Response.json({ estado: "peticion-incorrecta" }, { status: 400, headers: SIN_CACHE });
  }
  try {
    return Response.json(
      { estado: "ok", eventos: await eventosDelCalendario(hoy) },
      { headers: SIN_CACHE },
    );
  } catch {
    // Sin detalles: el mensaje podría revelar el enlace o cómo está montado el servidor.
    return Response.json({ estado: "error", eventos: [] }, { status: 502, headers: SIN_CACHE });
  }
}
