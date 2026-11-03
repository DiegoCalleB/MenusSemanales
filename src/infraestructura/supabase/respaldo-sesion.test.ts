import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  borrarCopiaDeSesion,
  guardarCopiaDeSesion,
  leerCopiaDeSesion,
  recuperarSesion,
} from "./respaldo-sesion";

const memoria = new Map<string, string>();
beforeEach(() => {
  memoria.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => memoria.get(k) ?? null,
      setItem: (k: string, v: string) => void memoria.set(k, v),
      removeItem: (k: string) => void memoria.delete(k),
    },
  });
  vi.stubGlobal("navigator", {});
});

const sesion = (t = "a1", r = "r1") => ({ access_token: t, refresh_token: r }) as Session;

function cliente(parcial: {
  getSession?: () => Promise<unknown>;
  setSession?: () => Promise<unknown>;
  signInWithPassword?: () => Promise<unknown>;
}) {
  return {
    auth: {
      getSession: parcial.getSession ?? (async () => ({ data: { session: null } })),
      setSession: parcial.setSession ?? (async () => ({ data: { session: null }, error: null })),
      signInWithPassword:
        parcial.signInWithPassword ?? (async () => ({ data: { session: null }, error: null })),
    },
  } as never;
}

describe("copia de la sesión", () => {
  it("guarda, lee y borra la copia; ignora sesiones incompletas", () => {
    guardarCopiaDeSesion(null);
    expect(leerCopiaDeSesion()).toBeNull();
    guardarCopiaDeSesion(sesion());
    expect(leerCopiaDeSesion()).toEqual({ access_token: "a1", refresh_token: "r1" });
    borrarCopiaDeSesion();
    expect(leerCopiaDeSesion()).toBeNull();
  });

  it("una copia corrupta se ignora", () => {
    memoria.set("menus-semanales:sesion", "{no es json");
    expect(leerCopiaDeSesion()).toBeNull();
  });
});

describe("recuperarSesion", () => {
  it("usa la sesión normal si está", async () => {
    const s = sesion("normal");
    const r = await recuperarSesion(
      cliente({ getSession: async () => ({ data: { session: s } }) }),
    );
    expect(r).toBe(s);
  });

  it("si faltan las cookies, restaura la sesión con la copia", async () => {
    guardarCopiaDeSesion(sesion("vieja", "rr"));
    const setSession = vi.fn(async () => ({ data: { session: sesion("nueva") }, error: null }));
    const r = await recuperarSesion(cliente({ setSession }));
    expect(setSession).toHaveBeenCalledWith({ access_token: "vieja", refresh_token: "rr" });
    expect(r?.access_token).toBe("nueva");
  });

  it("si el servidor rechaza la copia, la borra", async () => {
    guardarCopiaDeSesion(sesion());
    const r = await recuperarSesion(
      cliente({
        setSession: async () => ({
          data: { session: null },
          error: { name: "AuthApiError", status: 400, message: "Invalid Refresh Token" },
        }),
      }),
    );
    expect(r).toBeNull();
    expect(leerCopiaDeSesion()).toBeNull();
  });

  it("si no hay red, conserva la copia para otro intento", async () => {
    guardarCopiaDeSesion(sesion());
    const r = await recuperarSesion(
      cliente({
        setSession: async () => ({
          data: { session: null },
          error: { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" },
        }),
      }),
    );
    expect(r).toBeNull();
    expect(leerCopiaDeSesion()).not.toBeNull();
  });

  it("sin cookies ni copia, entra con la contraseña guardada en el navegador", async () => {
    vi.stubGlobal("window", {
      ...(globalThis as { window: object }).window,
      PasswordCredential: class {},
    });
    vi.stubGlobal("navigator", {
      credentials: {
        get: async () => ({ id: "diego@ejemplo.test", password: "clave-larga-1234" }),
      },
    });
    const signInWithPassword = vi.fn(async () => ({
      data: { session: sesion("por-clave") },
      error: null,
    }));
    const r = await recuperarSesion(cliente({ signInWithPassword }));
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "diego@ejemplo.test",
      password: "clave-larga-1234",
    });
    expect(r?.access_token).toBe("por-clave");
  });

  it("sin ninguna de las tres cosas, no hay sesión", async () => {
    expect(await recuperarSesion(cliente({}))).toBeNull();
  });
});
