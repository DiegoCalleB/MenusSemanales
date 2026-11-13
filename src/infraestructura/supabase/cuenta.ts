import type { SupabaseClient, User } from "@supabase/supabase-js";
import { URL_APP } from "@/aplicacion/enlaces";
import type { Database, Json } from "./database.types";
import {
  guardarContrasenaEnElNavegador,
  olvidarEntradaAutomatica,
  recuperarSesion,
} from "./respaldo-sesion";

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
  if (m.includes("invalid login credentials"))
    return "El correo o la contraseña no son correctos. Si aún no has puesto contraseña, entra con un código.";
  if (m.includes("should be different") || m.includes("same password"))
    return "Esa ya es tu contraseña. Elige otra distinta.";
  if (m.includes("password") && (m.includes("weak") || m.includes("least") || m.includes("short")))
    return "Esa contraseña es demasiado débil. Usa al menos 10 caracteres.";
  if (m.includes("invalid") && m.includes("token"))
    return "El código no es correcto o ha caducado.";
  if (error?.code === "22023" || error?.code === "42501") return error.message ?? "No permitido.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Sin conexión. Inténtalo de nuevo.";
  return "No se ha podido completar. Inténtalo de nuevo.";
}

export async function usuarioActual(cliente: Cliente): Promise<User | null> {
  return (await recuperarSesion(cliente))?.user ?? null;
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

/**
 * El enlace del correo lleva a la dirección definitiva de la app (D-126) y no a la que Supabase
 * tenga como «Site URL». Esa dirección debe estar también en las Redirect URLs de Supabase; si no
 * lo está, Supabase vuelve a usar el Site URL.
 */
export const pedirCodigoPorCorreo = (cliente: Cliente, correo: string) =>
  cliente.auth.signInWithOtp({
    email: correo,
    options: { shouldCreateUser: true, emailRedirectTo: URL_APP },
  });

export const verificarCodigo = (cliente: Cliente, correo: string, codigo: string) =>
  cliente.auth.verifyOtp({ email: correo, token: codigo, type: "email" });

/** Entrar con contraseña: no depende de que llegue un correo (que tiene tope de envíos por hora). */
export async function entrarConContrasena(cliente: Cliente, correo: string, contrasena: string) {
  const r = await cliente.auth.signInWithPassword({ email: correo, password: contrasena });
  // Con la contraseña guardada en el navegador, la próxima vez entra sola.
  if (r.data.session) void guardarContrasenaEnElNavegador(correo, contrasena);
  return r;
}
/** Pone o cambia la contraseña de quien ya ha entrado. */
export async function ponerContrasenaNueva(cliente: Cliente, contrasena: string) {
  const r = await cliente.auth.updateUser({ password: contrasena });
  const correo = r.data.user?.email;
  if (!r.error && correo) void guardarContrasenaEnElNavegador(correo, contrasena);
  return r;
}

export const entrarSinCorreo = (cliente: Cliente) => cliente.auth.signInAnonymously();
export async function salir(cliente: Cliente) {
  await olvidarEntradaAutomatica();
  return cliente.auth.signOut();
}

export const crearHogarNuevo = (cliente: Cliente, nombre: string) =>
  cliente.rpc("crear_hogar", { p_nombre: nombre });
export const crearInvitacion = (cliente: Cliente, hogarId: string) =>
  cliente.rpc("crear_invitacion", { p_hogar_id: hogarId, p_rol: "miembro" });
export const unirseConCodigo = (cliente: Cliente, codigo: string) =>
  cliente.rpc("unirse_a_hogar", { p_codigo: codigo });

/** Código para que una persona concreta entre y quede vinculada a su cuenta (D-091). */
export const crearInvitacionDePersona = (cliente: Cliente, hogarId: string, personaId: string) =>
  cliente.rpc("crear_invitacion_persona", { p_hogar_id: hogarId, p_persona_id: personaId });
export const vincularmeAPersona = (cliente: Cliente, hogarId: string, personaId: string) =>
  cliente.rpc("vincular_persona_propia", { p_hogar_id: hogarId, p_persona_id: personaId });
export const miPersonaEnElHogar = (cliente: Cliente, hogarId: string) =>
  cliente.rpc("mi_persona", { p_hogar_id: hogarId });
export const leerHogarDeTablas = (cliente: Cliente, hogarId: string) =>
  cliente.rpc("leer_hogar_tablas", { p_hogar_id: hogarId });
export const aplicarCambiosATablas = (cliente: Cliente, hogarId: string, cambios: Json) =>
  cliente.rpc("aplicar_cambios_tablas", { p_hogar_id: hogarId, p_cambios: cambios });

/** Enlace secreto del calendario del hogar (D-083). Con `renovar`, el anterior deja de valer. */
export const enlaceDelCalendario = (cliente: Cliente, hogarId: string, renovar = false) =>
  cliente.rpc("enlace_calendario", { p_hogar_id: hogarId, p_renovar: renovar });

/** Guarda la suscripción de este móvil para las notificaciones (D-115). */
export const guardarSuscripcionPush = (
  cliente: Cliente,
  hogarId: string,
  s: { endpoint: string; p256dh: string; auth: string },
) =>
  cliente.rpc("guardar_suscripcion_push", {
    p_hogar_id: hogarId,
    p_endpoint: s.endpoint,
    p_p256dh: s.p256dh,
    p_auth: s.auth,
  });
export const quitarSuscripcionPush = (cliente: Cliente, endpoint: string) =>
  cliente.rpc("quitar_suscripcion_push", { p_endpoint: endpoint });
/** Pide a la base de datos que mande una notificación de prueba a este móvil (D-139). */
export const pedirPruebaPush = (cliente: Cliente, hogarId: string, endpoint: string) =>
  cliente.rpc("pedir_prueba_push", { p_hogar_id: hogarId, p_endpoint: endpoint });
