import { sincronizarMenuCole } from "@/aplicacion/sincronizar-menu-cole";
import { comprobarSecretoDeAvisos } from "@/infraestructura/avisos/claves";
import { enviarPush } from "@/infraestructura/avisos/push";
import { leerSuscripciones, olvidarSuscripcion } from "@/infraestructura/avisos/suscripciones";
import { hoyEnMadrid } from "@/infraestructura/calendario-suscrito";
import { transcribirMenuCole } from "@/infraestructura/ia/cole";
import {
  bajarMenuBasal,
  centrosConBlog,
  fuentesVistas,
  leerEntradasDelBlog,
  registrarMenu,
} from "@/infraestructura/menu-cole-blog";

/** Bajar el PDF y leerlo con IA puede tardar. */
export const maxDuration = 300;

const responder = (cuerpo: unknown, status: number) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/**
 * La sincronización diaria del menú del cole (D-173). La llama la base de datos (pg_cron) con el
 * mismo secreto que los avisos; sin él, 401 y no hace nada.
 */
export async function POST(request: Request) {
  const secreto = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!secreto) return responder({ error: "no-autorizado" }, 401);
  let claves;
  try {
    const r = await comprobarSecretoDeAvisos(secreto);
    if (!r.valido) return responder({ error: "no-autorizado" }, 401);
    claves = r.claves;
  } catch {
    return responder({ error: "no-disponible" }, 502);
  }

  try {
    const resultado = await sincronizarMenuCole({
      hoy: hoyEnMadrid(),
      ahora: () => Date.now(),
      centros: () => centrosConBlog(secreto),
      entradas: leerEntradasDelBlog,
      vistas: (centro) => fuentesVistas(secreto, centro),
      pdf: bajarMenuBasal,
      transcribir: (base64) => transcribirMenuCole({ mime: "application/pdf", base64 }),
      registrar: (centro, post, res, dias) => registrarMenu(secreto, centro, post, res, dias),
      avisar: async (token, titulo, cuerpo) => {
        for (const s of await leerSuscripciones(token)) {
          const r = await enviarPush(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            { titulo, cuerpo, url: "/menu/cole" },
            undefined,
            claves,
          );
          if (r === "caducada") await olvidarSuscripcion(token, s.endpoint);
        }
      },
    });
    return responder({ resultado }, 200);
  } catch (e) {
    console.error("[menu-cole] sincronizar", e instanceof Error ? e.message : "desconocido");
    return responder({ error: "no-disponible" }, 502);
  }
}
