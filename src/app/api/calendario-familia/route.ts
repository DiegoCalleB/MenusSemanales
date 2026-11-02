import { eventosDelCalendario, enlaceConfigurado } from "@/infraestructura/calendario-externo";

const SIN_CACHE = { "Cache-Control": "no-store" } as const;

/** ¿Es miembro de un hogar? Se lo preguntamos a Supabase con su propia sesión: la RLS decide. */
async function esMiembro(token: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return false;
  try {
    const r = await fetch(`${url}/rest/v1/miembro?select=hogar_id&limit=1`, {
      headers: { apikey: clave, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!r.ok) return false;
    const filas: unknown = await r.json();
    return Array.isArray(filas) && filas.length > 0;
  } catch {
    return false;
  }
}

/**
 * Eventos del Google Calendar «Familia» (D-074). Solo para miembros de un hogar: el enlace secreto
 * da acceso a todo el calendario, así que esta ruta nunca responde a quien no haya iniciado sesión.
 */
export async function GET(request: Request) {
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !(await esMiembro(token))) {
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
