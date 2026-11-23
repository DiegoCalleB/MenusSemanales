import "server-only";
import {
  MAX_CERRAR_POR_VEZ,
  MAX_CREAR_POR_VEZ,
  NOMBRE_PROYECTO,
  type ResultadoDeSincronizacion,
  type TareaDeTodoist,
  esIdDeTodoist,
} from "@/dominio/todoist";

/**
 * Habla con Todoist (D-205) desde el servidor, con el token personal de las variables de Railway
 * (`TODOIST_TOKEN`): el token nunca llega al navegador. API v1 de Todoist.
 */

const BASE = "https://api.todoist.com/api/v1";
const PAGINAS_MAX = 10;
const ESPERA_MS = 8000;

type Fetch = typeof fetch;

export class TodoistError extends Error {
  constructor(
    readonly motivo: "token" | "red" | "respuesta" | "demasiadas",
    mensaje?: string,
  ) {
    super(mensaje ?? motivo);
  }
}

async function pedir(
  token: string,
  ruta: string,
  opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown; permitir?: number[] } = {},
  f: Fetch,
): Promise<unknown> {
  let r: Response;
  try {
    r = await f(`${BASE}${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opciones.cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(opciones.cuerpo !== undefined ? { body: JSON.stringify(opciones.cuerpo) } : {}),
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: "no-store",
    });
  } catch {
    throw new TodoistError("red");
  }
  if (r.status === 401 || r.status === 403) throw new TodoistError("token");
  if (opciones.permitir?.includes(r.status)) return null;
  if (!r.ok) throw new TodoistError("respuesta", `todoist-http-${r.status}`);
  if (r.status === 204) return null;
  try {
    return await r.json();
  } catch {
    throw new TodoistError("respuesta");
  }
}

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** Recorre una lista paginada (`results` + `next_cursor`); si no cabe, falla (nunca devuelve media lista). */
async function todas(
  token: string,
  ruta: string,
  f: Fetch,
): Promise<Array<Record<string, unknown>>> {
  const salida: Array<Record<string, unknown>> = [];
  let cursor: string | null = null;
  for (let i = 0; i < PAGINAS_MAX; i++) {
    const sep = ruta.includes("?") ? "&" : "?";
    const url: string = `${ruta}${sep}limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const v = await pedir(token, url, {}, f);
    if (!esObjeto(v) || !Array.isArray(v.results)) throw new TodoistError("respuesta");
    for (const x of v.results) if (esObjeto(x)) salida.push(x);
    cursor = typeof v.next_cursor === "string" && v.next_cursor ? v.next_cursor : null;
    if (!cursor) return salida;
  }
  throw new TodoistError("demasiadas");
}

/** El proyecto «¡Hecho!»: el que ya hay o, si no, uno nuevo. */
async function proyecto(token: string, f: Fetch): Promise<string> {
  const lista = await todas(token, "/projects", f);
  const existente = lista.find((p) => p.name === NOMBRE_PROYECTO && p.is_archived !== true);
  if (existente && esIdDeTodoist(existente.id)) return existente.id;
  const nuevo = await pedir(
    token,
    "/projects",
    { metodo: "POST", cuerpo: { name: NOMBRE_PROYECTO } },
    f,
  );
  if (!esObjeto(nuevo) || !esIdDeTodoist(nuevo.id)) throw new TodoistError("respuesta");
  return nuevo.id;
}

/**
 * Aplica en Todoist lo que se manda (cerrar y crear) y devuelve las tareas que quedan abiertas en el
 * proyecto «¡Hecho!». Si algo falla antes de poder leer la lista entera, falla todo: la app no cambia
 * nada con una lista a medias.
 */
export async function sincronizarConTodoist(
  token: string,
  peticion: { crear: ReadonlyArray<{ ref: string; content: string }>; cerrar: readonly string[] },
  f: Fetch = fetch,
): Promise<ResultadoDeSincronizacion> {
  const proyectoId = await proyecto(token, f);

  const cerradas: string[] = [];
  for (const id of peticion.cerrar.filter(esIdDeTodoist).slice(0, MAX_CERRAR_POR_VEZ)) {
    // 404/400: ya estaba cerrada o borrada; vale igual.
    await pedir(
      token,
      `/tasks/${encodeURIComponent(id)}/close`,
      { metodo: "POST", permitir: [400, 404] },
      f,
    );
    cerradas.push(id);
  }

  const creadas: Array<{ ref: string; id: string }> = [];
  for (const t of peticion.crear.slice(0, MAX_CREAR_POR_VEZ)) {
    const content = t.content.replace(/\s+/g, " ").trim().slice(0, 500);
    if (!content) continue;
    const v = await pedir(
      token,
      "/tasks",
      { metodo: "POST", cuerpo: { content, project_id: proyectoId } },
      f,
    );
    if (esObjeto(v) && esIdDeTodoist(v.id)) creadas.push({ ref: t.ref, id: v.id });
  }

  const tareas = await todas(token, `/tasks?project_id=${encodeURIComponent(proyectoId)}`, f);
  const activas: TareaDeTodoist[] = tareas.flatMap((x) =>
    esIdDeTodoist(x.id) &&
    typeof x.content === "string" &&
    x.checked !== true &&
    x.is_deleted !== true
      ? [{ id: x.id, content: x.content }]
      : [],
  );
  return { creadas, activas, cerradas };
}
