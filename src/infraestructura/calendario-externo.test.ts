import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/calendario-familia/route";
import { enlaceValido } from "./calendario-externo";

describe("enlace del calendario", () => {
  it("solo acepta HTTPS de calendar.google.com", () => {
    expect(enlaceValido("https://calendar.google.com/calendar/ical/x/private-y/basic.ics")).toBe(
      true,
    );
    expect(enlaceValido("http://calendar.google.com/calendar/ical/x")).toBe(false);
    expect(enlaceValido("https://evil.example/calendar.google.com")).toBe(false);
    expect(enlaceValido("https://calendar.google.com.evil.example/x")).toBe(false);
    expect(enlaceValido("no es una url")).toBe(false);
    expect(enlaceValido("")).toBe(false);
  });
});

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
