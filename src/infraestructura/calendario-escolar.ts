import "server-only";
import {
  type CalendariosEscolares,
  calendariosEscolaresDe,
  registrarCursos,
} from "@/dominio/calendario-escolar";

/**
 * El calendario escolar leído automáticamente (D-146), en la base de datos. Todo con la clave
 * pública de Supabase: leer es libre; escribir, solo con el secreto de la llamada programada.
 */

function acceso() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && clave ? { url, clave } : null;
}

async function rpc(nombre: string, cuerpo: unknown, cache?: RequestInit): Promise<unknown> {
  const a = acceso();
  if (!a) throw new Error("supabase-no-configurado");
  const r = await fetch(`${a.url}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { apikey: a.clave, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(6000),
    ...(cache ?? { cache: "no-store" }),
  });
  if (!r.ok) throw new Error("supabase-no-responde");
  return r.json();
}

const VACIO: CalendariosEscolares = { cursos: [], comprobadoEn: null, resultado: null };

/** Los cursos leídos y la última comprobación. Si la base de datos no responde, nada (se avisa de más). */
export async function leerCalendariosEscolares(fresco = false): Promise<CalendariosEscolares> {
  try {
    const j = await rpc(
      "calendarios_escolares",
      {},
      fresco ? undefined : ({ next: { revalidate: 3600 } } as RequestInit),
    );
    return calendariosEscolaresDe(j);
  } catch {
    return VACIO;
  }
}

/** Lee los cursos y los deja registrados para este proceso. Devuelve lo leído. */
export async function cargarCursosEscolares(): Promise<CalendariosEscolares> {
  const c = await leerCalendariosEscolares();
  registrarCursos(c.cursos);
  return c;
}

export async function guardarCalendarioEscolar(
  secreto: string,
  anio: number,
  curso: unknown,
  huella: string,
): Promise<"nuevo" | "cambiado" | "igual" | null> {
  const r = await rpc("guardar_calendario_escolar", {
    p_secreto: secreto,
    p_anio: anio,
    p_curso: curso,
    p_huella: huella,
  });
  return r === "nuevo" || r === "cambiado" || r === "igual" ? r : null;
}

export async function anotarComprobacion(secreto: string, resultado: string): Promise<void> {
  await rpc("anotar_comprobacion_calendario", { p_secreto: secreto, p_resultado: resultado });
}
