import { describe, expect, it } from "vitest";
import type { EstadoHogar } from "@/aplicacion/estado";
import { estadoInicialDemo } from "@/aplicacion/datos-demo";
import { VERSION_ALMACEN, crearAlmacenLocal, esEstadoValido } from "./almacen-local";

function falsoStorage(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
}

describe("almacén local del modo prueba", () => {
  it("guarda y recupera el estado sin el aviso", () => {
    const s = falsoStorage();
    const almacen = crearAlmacenLocal(s);
    const estado = { ...estadoInicialDemo(), aviso: { id: 1, tipo: "ok" as const, texto: "x" } };
    almacen.guardar(estado);
    expect(almacen.cargar()).toEqual({ ...estado, aviso: null });
  });

  it("devuelve null si no hay nada, si está roto o si es de otra versión", () => {
    expect(crearAlmacenLocal(falsoStorage()).cargar()).toBeNull();
    const clave = "menus-semanales:prueba";
    expect(crearAlmacenLocal(falsoStorage({ [clave]: "{no es json" })).cargar()).toBeNull();
    const vieja = JSON.stringify({ version: VERSION_ALMACEN + 1, estado: estadoInicialDemo() });
    expect(crearAlmacenLocal(falsoStorage({ [clave]: vieja })).cargar()).toBeNull();
    const rota = JSON.stringify({ version: VERSION_ALMACEN, estado: { hoy: "2026-11-04" } });
    expect(crearAlmacenLocal(falsoStorage({ [clave]: rota })).cargar()).toBeNull();
  });

  it("lo guardado antes de existir la agenda se carga con la agenda vacía", () => {
    const viejo: Partial<EstadoHogar> = { ...estadoInicialDemo() };
    delete viejo.agenda;
    const s = falsoStorage({
      "menus-semanales:prueba": JSON.stringify({ version: VERSION_ALMACEN, estado: viejo }),
    });
    expect(crearAlmacenLocal(s).cargar()?.agenda).toEqual([]);
  });

  it("borrar elimina lo guardado", () => {
    const s = falsoStorage();
    const almacen = crearAlmacenLocal(s);
    almacen.guardar(estadoInicialDemo());
    almacen.borrar();
    expect(almacen.cargar()).toBeNull();
  });

  it("no lanza si el almacenamiento falla o no existe", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("lleno");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    const almacen = crearAlmacenLocal(roto);
    expect(almacen.cargar()).toBeNull();
    expect(() => almacen.guardar(estadoInicialDemo())).not.toThrow();
    expect(() => almacen.borrar()).not.toThrow();
    const sin = crearAlmacenLocal(null);
    expect(sin.cargar()).toBeNull();
    expect(() => sin.guardar(estadoInicialDemo())).not.toThrow();
  });

  it("valida la forma del estado", () => {
    expect(esEstadoValido(estadoInicialDemo())).toBe(true);
    expect(esEstadoValido(null)).toBe(false);
    expect(esEstadoValido({ ...estadoInicialDemo(), platos: "no" })).toBe(false);
  });
});
