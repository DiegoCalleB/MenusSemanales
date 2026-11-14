import { createHash } from "node:crypto";
import {
  type Dependencias,
  comprobarCalendarioEscolar,
  comprobarCurso,
  resumenDeComprobacion,
} from "@/aplicacion/comprobar-calendario-escolar";
import { CURSOS, diasLectivos, registrarCursos } from "@/dominio/calendario-escolar";
import { PAGINA_CALENDARIO_ESCOLAR } from "@/dominio/web-calendario-escolar";
import { comprobarSecretoDeAvisos } from "@/infraestructura/avisos/claves";
import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import {
  anotarComprobacion,
  guardarCalendarioEscolar,
  leerCalendariosEscolares,
} from "@/infraestructura/calendario-escolar";
import { leerCalendarioEscolar } from "@/infraestructura/ia/calendario-escolar";

/** La comprobación puede tardar: dos lecturas con IA de dos PDF. */
export const maxDuration = 300;

const MAX_PDF = 10 * 1024 * 1024;
const responder = (cuerpo: unknown, status: number) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

async function bajarPdf(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
    if (!r.ok) return null;
    const datos = Buffer.from(await r.arrayBuffer());
    // Solo PDF de verdad y de un tamaño razonable.
    if (datos.length > MAX_PDF || datos.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
    return datos.toString("base64");
  } catch {
    return null;
  }
}

/**
 * La comprobación mensual del calendario escolar (D-146). La llama la base de datos (pg_cron) con
 * el mismo secreto que los avisos; sin él, 401 y no hace nada.
 */
export async function POST(request: Request) {
  const secreto = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!secreto) return responder({ error: "no-autorizado" }, 401);
  try {
    if (!(await comprobarSecretoDeAvisos(secreto)).valido) {
      return responder({ error: "no-autorizado" }, 401);
    }
  } catch {
    return responder({ error: "no-disponible" }, 502);
  }

  registrarCursos((await leerCalendariosEscolares(true)).cursos);
  const deps: Dependencias = {
    hoy: hoyEnMadrid(),
    pagina: async () => {
      const r = await fetch(PAGINA_CALENDARIO_ESCOLAR, {
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`pagina-${r.status}`);
      return r.text();
    },
    pdf: bajarPdf,
    leer: (anio, pdfs) => leerCalendarioEscolar(anio, pdfs),
    guardar: (anio, curso, huella) => guardarCalendarioEscolar(secreto, anio, curso, huella),
    huella: (t) => createHash("sha256").update(t).digest("hex"),
  };

  // Prueba (`{"prueba": 2026}`): lee un curso revisado a mano, sin guardar nada, y dice si la
  // lectura automática da exactamente los mismos días. Así se comprueba la IA antes de necesitarla.
  const prueba = await leerPrueba(request);
  if (prueba !== null) {
    const revisado = CURSOS.find((c) => c.inicio.startsWith(String(prueba)));
    if (!revisado) return responder({ error: "sin-revisado" }, 400);
    const html = await deps.pagina().catch(() => "");
    const r = await comprobarCurso(prueba, html, { ...deps, guardar: async () => "igual" });
    if (!("curso" in r))
      return responder(
        { prueba, estado: r.estado, ...("errores" in r ? { errores: r.errores } : {}) },
        200,
      );
    const leidos = diasLectivos(r.curso);
    const buenos = diasLectivos(revisado);
    return responder(
      {
        prueba,
        estado: r.estado,
        coincide: JSON.stringify(leidos) === JSON.stringify(buenos),
        sobran: leidos.filter((f) => !buenos.includes(f)),
        faltan: buenos.filter((f) => !leidos.includes(f)),
      },
      200,
    );
  }

  const resultado = await comprobarCalendarioEscolar(deps);
  const resumen = resumenDeComprobacion(resultado);
  try {
    await anotarComprobacion(secreto, resumen);
  } catch {
    // Que no se pueda apuntar no cambia lo que se ha hecho.
  }
  console.info("[calendario-escolar]", resumen);
  return responder(
    { resultado: resultado.map((r) => ({ anio: r.anio, estado: r.estado })), resumen },
    200,
  );
}

async function leerPrueba(request: Request): Promise<number | null> {
  try {
    const c = (await request.json()) as { prueba?: unknown };
    return typeof c?.prueba === "number" && Number.isInteger(c.prueba) ? c.prueba : null;
  } catch {
    return null;
  }
}
