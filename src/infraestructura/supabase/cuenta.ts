import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type Cliente = SupabaseClient<Database>;

export interface HogarDeUsuario {
  id: string;
  nombre: string;
  rol: string;
}

/** Traduce los errores de Supabase a mensajes que entiende una persona. */
export function mensajeDeError(error: { message?: string; code?: string } | null): string {
  const m = (error?.message ?? "").toLowerCase();
  if (error?.code === "P0002" || m.includes("invitación"))
    return "Ese código no vale o ha caducado.";
  if (m.includes("anonymous") && m.includes("disabled"))
    return "Entrar sin correo no está activado todavía en esta app.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos: espera un poco.";
  if (m.includes("invalid") && m.includes("token"))
    return "El código no es correcto o ha caducado.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Sin conexión. Inténtalo de nuevo.";
  return "No se ha podido completar. Inténtalo de nuevo.";
}

export async function usuarioActual(cliente: Cliente): Promise<User | null> {
  const { data } = await cliente.auth.getSession();
  return data.session?.user ?? null;
}

export async function hogarDelUsuario(cliente: Cliente): Promise<HogarDeUsuario | null> {
  const { data, error } = await cliente
    .from("miembro")
    .select("hogar_id, rol, hogar(nombre)")
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const hogar = data.hogar as { nombre: string } | { nombre: string }[] | null;
  const nombre = Array.isArray(hogar) ? hogar[0]?.nombre : hogar?.nombre;
  return { id: data.hogar_id, nombre: nombre ?? "Mi hogar", rol: data.rol };
}

export const pedirCodigoPorCorreo = (cliente: Cliente, correo: string) =>
  cliente.auth.signInWithOtp({ email: correo, options: { shouldCreateUser: true } });

export const verificarCodigo = (cliente: Cliente, correo: string, codigo: string) =>
  cliente.auth.verifyOtp({ email: correo, token: codigo, type: "email" });

export const entrarSinCorreo = (cliente: Cliente) => cliente.auth.signInAnonymously();
export const salir = (cliente: Cliente) => cliente.auth.signOut();

export const crearHogarNuevo = (cliente: Cliente, nombre: string) =>
  cliente.rpc("crear_hogar", { p_nombre: nombre });
export const crearInvitacion = (cliente: Cliente, hogarId: string) =>
  cliente.rpc("crear_invitacion", { p_hogar_id: hogarId, p_rol: "miembro" });
export const unirseConCodigo = (cliente: Cliente, codigo: string) =>
  cliente.rpc("unirse_a_hogar", { p_codigo: codigo });

/** Enlace secreto del calendario del hogar (D-083). Con `renovar`, el anterior deja de valer. */
export const enlaceDelCalendario = (cliente: Cliente, hogarId: string, renovar = false) =>
  cliente.rpc("enlace_calendario", { p_hogar_id: hogarId, p_renovar: renovar });
