import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TodoistError, sincronizarConTodoist } from "./todoist";

type Llamada = { url: string; metodo: string; cuerpo: unknown; auth: string | null };

function simulado(responder: (l: Llamada) => { status?: number; json?: unknown } | undefined): {
  f: typeof fetch;
  llamadas: Llamada[];
} {
  const llamadas: Llamada[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const l: Llamada = {
      url: String(url).replace("https://api.todoist.com/api/v1", ""),
      metodo: init?.method ?? "GET",
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init?.headers).get("Authorization"),
    };
    llamadas.push(l);
    const r = responder(l) ?? { status: 404 };
    const status = r.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(r.json ?? {}), { status });
  }) as unknown as typeof fetch;
  return { f, llamadas };
}

describe("Todoist: servidor (D-205)", () => {
  it("usa el proyecto «¡Hecho!» que ya hay, cierra, crea y devuelve lo abierto", async () => {
    const { f, llamadas } = simulado((l) => {
      if (l.url.startsWith("/projects?"))
        return {
          json: {
            results: [
              { id: "P0", name: "Inbox" },
              { id: "P1", name: "¡Hecho!" },
            ],
            next_cursor: null,
          },
        };
      if (l.url === "/tasks/T9/close") return { status: 204 };
      if (l.url === "/tasks" && l.metodo === "POST") return { json: { id: "T10", content: "x" } };
      if (l.url.startsWith("/tasks?"))
        return {
          json: {
            results: [
              { id: "T1", content: "Uno", checked: false },
              { id: "T2", content: "Hecha", checked: true },
              { id: "T10", content: "Nueva", checked: false },
            ],
            next_cursor: null,
          },
        };
      return undefined;
    });
    const r = await sincronizarConTodoist(
      "TOKEN",
      { crear: [{ ref: "pen-1", content: "  Nueva  " }], cerrar: ["T9", "mal id"] },
      f,
    );
    expect(r).toEqual({
      creadas: [{ ref: "pen-1", id: "T10" }],
      activas: [
        { id: "T1", content: "Uno" },
        { id: "T10", content: "Nueva" },
      ],
      cerradas: ["T9"],
    });
    expect(llamadas.every((l) => l.auth === "Bearer TOKEN")).toBe(true);
    expect(llamadas.find((l) => l.metodo === "POST" && l.url === "/tasks")?.cuerpo).toEqual({
      content: "Nueva",
      project_id: "P1",
    });
    // No se crea un proyecto nuevo si ya existe.
    expect(llamadas.some((l) => l.metodo === "POST" && l.url === "/projects")).toBe(false);
    // Lista las tareas de ese proyecto.
    expect(llamadas.some((l) => l.url.startsWith("/tasks?project_id=P1"))).toBe(true);
  });

  it("crea el proyecto si no existe y sigue la paginación", async () => {
    let paginas = 0;
    const { f, llamadas } = simulado((l) => {
      if (l.url.startsWith("/projects?")) return { json: { results: [], next_cursor: null } };
      if (l.url === "/projects" && l.metodo === "POST")
        return { json: { id: "PN", name: "¡Hecho!" } };
      if (l.url.startsWith("/tasks?")) {
        paginas++;
        return paginas === 1
          ? { json: { results: [{ id: "A", content: "a" }], next_cursor: "abc.def" } }
          : { json: { results: [{ id: "B", content: "b" }], next_cursor: null } };
      }
      return undefined;
    });
    const r = await sincronizarConTodoist("T", { crear: [], cerrar: [] }, f);
    expect(r.activas.map((t) => t.id)).toEqual(["A", "B"]);
    expect(llamadas.find((l) => l.metodo === "POST" && l.url === "/projects")?.cuerpo).toEqual({
      name: "¡Hecho!",
    });
    expect(llamadas.some((l) => l.url.includes("cursor=abc.def"))).toBe(true);
  });

  it("si la tarea ya estaba cerrada (404), no es un error", async () => {
    const { f } = simulado((l) => {
      if (l.url.startsWith("/projects?"))
        return { json: { results: [{ id: "P1", name: "¡Hecho!" }], next_cursor: null } };
      if (l.url.endsWith("/close")) return { status: 404 };
      if (l.url.startsWith("/tasks?")) return { json: { results: [], next_cursor: null } };
      return undefined;
    });
    const r = await sincronizarConTodoist("T", { crear: [], cerrar: ["T1"] }, f);
    expect(r.cerradas).toEqual(["T1"]);
  });

  it("con un token malo o sin red, falla sin devolver una lista a medias", async () => {
    const malo = simulado(() => ({ status: 401 }));
    await expect(
      sincronizarConTodoist("T", { crear: [], cerrar: [] }, malo.f),
    ).rejects.toMatchObject({
      motivo: "token",
    });
    const roto = vi.fn(async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;
    await expect(
      sincronizarConTodoist("T", { crear: [], cerrar: [] }, roto),
    ).rejects.toBeInstanceOf(TodoistError);
    // Una página falla: error, no una lista parcial.
    const media = simulado((l) => {
      if (l.url.startsWith("/projects?"))
        return { json: { results: [{ id: "P1", name: "¡Hecho!" }], next_cursor: null } };
      if (l.url.includes("cursor=")) return { status: 500 };
      if (l.url.startsWith("/tasks?"))
        return { json: { results: [{ id: "A", content: "a" }], next_cursor: "abc.def" } };
      return undefined;
    });
    await expect(
      sincronizarConTodoist("T", { crear: [], cerrar: [] }, media.f),
    ).rejects.toMatchObject({
      motivo: "respuesta",
    });
  });
});
