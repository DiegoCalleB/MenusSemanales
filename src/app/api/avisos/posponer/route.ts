import { posponerAviso } from "@/infraestructura/avisos/claves";

const responder = (cuerpo: unknown, status: number) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/**
 * El botón «Posponer 1 hora» de la notificación (D-204): el móvil manda el código de un solo uso que
 * iba en ella y la base de datos deja el aviso para dentro de una hora (hasta 3 veces seguidas). Sin
 * sesión: el código es aleatorio, caduca y solo sirve para eso. Si no vale, 404 y nada cambia.
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
    const hecho = await posponerAviso(codigo);
    return hecho === null
      ? responder({ error: "no-disponible" }, 502)
      : hecho
        ? responder({ pospuesto: true }, 200)
        : responder({ error: "no-encontrado" }, 404);
  } catch {
    return responder({ error: "no-disponible" }, 502);
  }
}
