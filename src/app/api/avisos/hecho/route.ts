import { marcarHechoDesdeAviso } from "@/infraestructura/avisos/claves";

const responder = (cuerpo: unknown, status: number) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/**
 * El botón «Hecho» de la notificación (D-151): el móvil manda el código de un solo uso que iba en
 * ella y la base de datos marca esas cosas de la mochila como preparadas. Sin sesión: el código es
 * aleatorio, caduca y solo sirve para eso. Si no vale, 404 y nada cambia.
 */
export async function POST(request: Request) {
  let codigo = "";
  try {
    const c = (await request.json()) as { codigo?: unknown };
    codigo = typeof c?.codigo === "string" ? c.codigo : "";
  } catch {
    return responder({ error: "no-valido" }, 400);
  }
  if (!/^[0-9a-f]{64}$/.test(codigo)) return responder({ error: "no-valido" }, 400);
  try {
    const marcadas = await marcarHechoDesdeAviso(codigo);
    return marcadas === null
      ? responder({ error: "no-encontrado" }, 404)
      : responder({ marcadas }, 200);
  } catch {
    return responder({ error: "no-disponible" }, 502);
  }
}
