import { eventosSuscritos } from "@/dominio/calendario-suscrito";
import { generarIcs } from "@/dominio/compartir";
import { cargarCursosEscolares } from "@/infraestructura/calendario-escolar";
import { leerPrevision } from "@/infraestructura/tiempo";
import {
  demasiadasPeticiones,
  hoyEnMadrid,
  leerResumenDelCalendario,
} from "@/infraestructura/calendario-suscrito";

const CABECERAS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
} as const;

/** El mismo 404 para «no existe», «mal formado» o «sin plan»: no se confirma nada a quien adivina. */
const noEncontrado = () =>
  new Response("No encontrado", {
    status: 404,
    headers: {
      ...CABECERAS,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

/**
 * Calendario suscrito de un hogar (D-083): `/api/calendario/<token>.ics?para=ana`. El móvil lo
 * pide solo cada cierto tiempo y muestra las alarmas con la app cerrada. El token es el secreto;
 * `para` elige de quién son las tareas y los avisos de regalo (no es secreto ni da más acceso).
 */
export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: crudo } = await ctx.params;
  const token = crudo.replace(/\.ics$/i, "");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sin-ip";
  if (demasiadasPeticiones(ip)) {
    return new Response("Demasiadas peticiones", {
      status: 429,
      headers: { ...CABECERAS, "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  const paraCrudo = new URL(request.url).searchParams.get("para");
  const para = paraCrudo && /^[a-z0-9_-]{1,40}$/i.test(paraCrudo) ? paraCrudo : null;

  let resumen;
  let tiempo;
  try {
    // Los cursos del calendario escolar leídos solos (D-146), para los días sin cole, y el tiempo
    // (D-154), que si no llega no impide nada (devuelve una lista vacía).
    [resumen, , tiempo] = await Promise.all([
      leerResumenDelCalendario(token),
      cargarCursosEscolares(),
      leerPrevision(),
    ]);
  } catch {
    // Sin detalles: un fallo de Supabase no debe contar nada del servidor.
    return new Response("No disponible", {
      status: 502,
      headers: { ...CABECERAS, "Cache-Control": "no-store" },
    });
  }
  if (!resumen) return noEncontrado();

  // Dos calendarios con el mismo token (D-140): las fechas, o con `solo=comidas` las comidas y cenas.
  const solo = new URL(request.url).searchParams.get("solo") === "comidas" ? "comidas" : "fechas";
  const ics = generarIcs(
    solo === "comidas" ? "¡Hecho! · Comidas" : "¡Hecho!",
    eventosSuscritos(resumen, { hoy: hoyEnMadrid(), para, solo, tiempo }),
    new Date(),
    1,
  );
  return new Response(ics, {
    headers: {
      ...CABECERAS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="menus-semanales.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
