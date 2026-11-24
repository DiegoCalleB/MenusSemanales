import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UN_DIA_MS, guardarCache, leerCache } from "./cache-local";
import { protegerAlmacenamiento } from "./almacenamiento";

function almacenFalso() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: almacenFalso() });
});
afterEach(() => vi.unstubAllGlobals());

describe("lo último que contestó el servidor (D-208)", () => {
  it("se guarda con su fecha y se lee mientras no sea viejo", () => {
    guardarCache("tiempo", { dias: [1, 2] }, 1_000);
    expect(leerCache("tiempo", UN_DIA_MS, 1_000 + 3_600_000)).toEqual({ dias: [1, 2] });
    expect(leerCache("tiempo", UN_DIA_MS, 1_000 + UN_DIA_MS + 1)).toBeNull();
    expect(leerCache("otra", UN_DIA_MS, 2_000)).toBeNull();
  });
  it("lo escrito en el futuro (reloj raro) o roto no vale", () => {
    guardarCache("x", 1, 10_000_000);
    expect(leerCache("x", UN_DIA_MS, 1_000)).toBeNull();
    (window.localStorage as unknown as { setItem: (k: string, v: string) => void }).setItem(
      "menus-semanales:cache:y",
      "{no es json",
    );
    expect(leerCache("y", UN_DIA_MS)).toBeNull();
  });
  it("sin almacenamiento no falla", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("bloqueado");
      },
    });
    expect(() => guardarCache("a", 1)).not.toThrow();
    expect(leerCache("a", UN_DIA_MS)).toBeNull();
  });
});

describe("almacenamiento protegido (D-208)", () => {
  it("si ya lo está, true; si lo concede, true; si no, false; sin soporte, null", async () => {
    expect(
      await protegerAlmacenamiento({ persisted: async () => true, persist: async () => false }),
    ).toBe(true);
    expect(
      await protegerAlmacenamiento({ persisted: async () => false, persist: async () => true }),
    ).toBe(true);
    expect(
      await protegerAlmacenamiento({ persisted: async () => false, persist: async () => false }),
    ).toBe(false);
    expect(await protegerAlmacenamiento(undefined)).toBeNull();
    expect(
      await protegerAlmacenamiento({
        persisted: async () => {
          throw new Error("no");
        },
        persist: async () => true,
      }),
    ).toBeNull();
  });
});
