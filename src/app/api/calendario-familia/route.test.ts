import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/calendario-familia", () => {
  it("sin sesión no entrega nada", async () => {
    const r = await GET(new Request("http://localhost/api/calendario-familia?hoy=2026-11-02"));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ estado: "sin-permiso" });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("con una sesión que Supabase no reconoce tampoco", async () => {
    const r = await GET(
      new Request("http://localhost/api/calendario-familia?hoy=2026-11-02", {
        headers: { authorization: "Bearer falso" },
      }),
    );
    expect(r.status).toBe(401);
  });
});
