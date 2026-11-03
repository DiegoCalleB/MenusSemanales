import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Que la app entre siempre sola (D-112). La sesión vive en cookies; algunos navegadores (Brave con
 * «Olvidarme cuando cierre este sitio», límites de cookies puestas por script…) las borran entre un
 * uso y otro. Aquí hay dos redes de seguridad, por orden:
 *   1. una COPIA de los dos tokens en el almacenamiento local, que sobrevive cuando solo se borran
 *      las cookies: si la sesión no está, se restaura con ella;
 *   2. la CONTRASEÑA guardada en el gestor de contraseñas del navegador (Credential Management),
 *      que se pide en silencio y vuelve a iniciar sesión sin que la persona haga nada.
 * Al pulsar «Salir» se borra todo, para que salir de verdad sea salir.
 */

const CLAVE = "menus-semanales:sesion";

interface Copia {
  access_token: string;
  refresh_token: string;
}

const almacen = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function guardarCopiaDeSesion(sesion: Session | null): void {
  if (!sesion?.access_token || !sesion.refresh_token) return;
  try {
    const c: Copia = { access_token: sesion.access_token, refresh_token: sesion.refresh_token };
    almacen()?.setItem(CLAVE, JSON.stringify(c));
  } catch {
    /* sin almacenamiento */
  }
}

export function leerCopiaDeSesion(): Copia | null {
  try {
    const t = almacen()?.getItem(CLAVE);
    if (!t) return null;
    const v = JSON.parse(t) as Partial<Copia>;
    return typeof v.access_token === "string" && typeof v.refresh_token === "string"
      ? { access_token: v.access_token, refresh_token: v.refresh_token }
      : null;
  } catch {
    return null;
  }
}

export function borrarCopiaDeSesion(): void {
  try {
    almacen()?.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento */
  }
}

/** ¿Fallo de red (se reintentará solo) o respuesta del servidor diciendo que ya no vale? */
const esFalloDeRed = (e: { name?: string; status?: number; message?: string } | null) =>
  !!e &&
  (e.name === "AuthRetryableFetchError" ||
    e.status === 0 ||
    /failed to fetch|network|load failed/i.test(e.message ?? ""));

// --- Gestor de contraseñas del navegador (Credential Management) ---------------------------------

type CredencialDeContrasena = { id: string; password?: string };
type ConstructorCredencial = new (datos: { id: string; password: string }) => Credential;

const credenciales = () =>
  typeof navigator === "undefined" ? undefined : (navigator.credentials as CredentialsContainer);

/** Guarda el correo y la contraseña en el gestor del navegador para poder entrar solos después. */
export async function guardarContrasenaEnElNavegador(correo: string, contrasena: string) {
  try {
    const Construir = (window as unknown as { PasswordCredential?: ConstructorCredencial })
      .PasswordCredential;
    if (!Construir || !credenciales()?.store) return;
    await credenciales()?.store(new Construir({ id: correo, password: contrasena }));
  } catch {
    /* el navegador no lo admite o la persona dijo que no */
  }
}

/** Pide en silencio la contraseña guardada (sin ventanas). Devuelve null si no hay o no se puede. */
export async function contrasenaDelNavegador(): Promise<{
  correo: string;
  contrasena: string;
} | null> {
  try {
    if (!(window as unknown as { PasswordCredential?: unknown }).PasswordCredential) return null;
    const c = (await credenciales()?.get({
      password: true,
      mediation: "silent",
    } as CredentialRequestOptions)) as CredencialDeContrasena | null | undefined;
    return c?.id && c.password ? { correo: c.id, contrasena: c.password } : null;
  } catch {
    return null;
  }
}

/** Al salir de verdad: que el navegador no vuelva a entrar solo. */
export async function olvidarEntradaAutomatica(): Promise<void> {
  borrarCopiaDeSesion();
  try {
    await credenciales()?.preventSilentAccess?.();
  } catch {
    /* sin soporte */
  }
}

/**
 * Devuelve la sesión: la normal; si no está, la que se restaura con la copia; si tampoco, la que
 * sale de entrar en silencio con la contraseña guardada. `null` solo si de verdad no hay manera.
 */
export async function recuperarSesion(cliente: SupabaseClient<Database>): Promise<Session | null> {
  const normal = (await cliente.auth.getSession()).data.session;
  if (normal) return normal;

  const copia = leerCopiaDeSesion();
  if (copia) {
    const { data, error } = await cliente.auth.setSession(copia);
    if (data.session) return data.session;
    // Sin red no se descarta: mañana puede que sí funcione. Si el servidor la rechaza, sí.
    if (!esFalloDeRed(error)) borrarCopiaDeSesion();
  }

  const guardada = await contrasenaDelNavegador();
  if (guardada) {
    const { data } = await cliente.auth.signInWithPassword({
      email: guardada.correo,
      password: guardada.contrasena,
    });
    if (data.session) return data.session;
  }
  return null;
}
