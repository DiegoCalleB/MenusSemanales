import { describe, expect, it } from "vitest";
import { resumenDeUso, sinUso, usarSeccion, usoDeAlmacen, usosRecientes, verSeccion } from "./uso";

describe("uso de los apartados de Hoy (D-189)", () => {
  it("un apartado recién visto no cuenta como sin uso", () => {
    const u = verSeccion({}, "a", "Cuidarse", "2026-11-01");
    expect(sinUso(u, "a", "2026-11-10")).toBe(false);
    expect(sinUso(u, "a", "2026-11-15")).toBe(true);
    expect(sinUso(u, "no-existe", "2026-11-15")).toBe(false);
  });

  it("un toque reciente lo mantiene en uso, y uno viejo no", () => {
    let u = verSeccion({}, "a", "Cuidarse", "2026-11-01");
    u = usarSeccion(u, "a", "Cuidarse", "2026-11-05");
    expect(usosRecientes(u, "a", "2026-11-18")).toBe(1);
    expect(sinUso(u, "a", "2026-11-18")).toBe(false);
    expect(sinUso(u, "a", "2026-11-19")).toBe(true);
    u = usarSeccion(u, "a", "Cuidarse", "2026-11-19");
    expect(sinUso(u, "a", "2026-11-19")).toBe(false);
  });

  it("guarda solo los últimos 45 días y suma los toques del mismo día", () => {
    let u = usarSeccion({}, "a", "X", "2026-09-01");
    u = usarSeccion(u, "a", "X", "2026-11-19");
    u = usarSeccion(u, "a", "X", "2026-11-19");
    expect(u.a!.usos).toEqual({ "2026-11-19": 2 });
  });

  it("resume ordenando por toques y limpia lo que viene mal escrito", () => {
    let u = verSeccion({}, "a", "Papeles", "2026-10-01");
    u = usarSeccion(verSeccion(u, "b", "Mi día", "2026-10-01"), "b", "Mi día", "2026-11-18");
    expect(resumenDeUso(u, "2026-11-19").map((r) => [r.id, r.usos, r.sinUso])).toEqual([
      ["b", 1, false],
      ["a", 0, true],
    ]);
    expect(usoDeAlmacen("nada")).toEqual({});
    expect(
      usoDeAlmacen({ a: { nombre: 3 }, b: { nombre: "B", visto: "2026-11-01", usos: { x: 1 } } }),
    ).toEqual({
      b: { nombre: "B", visto: "2026-11-01", usos: {} },
    });
  });
});
