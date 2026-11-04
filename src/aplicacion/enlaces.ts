/**
 * La dirección definitiva de la app (D-126). Los enlaces que se mandan a otras personas (el código
 * para unirse al hogar, el regalo, el calendario) usan SIEMPRE esta dirección, y no la que tenga
 * abierta quien los envía: así no salen enlaces con un dominio antiguo, con un acceso directo viejo
 * ni con `localhost`.
 */
export const URL_APP = "https://yaestahecho.up.railway.app";

/** Dirección completa de una ruta de la app («/cuenta» → «https://yaestahecho.up.railway.app/cuenta»). */
export const enlaceDeApp = (ruta: string): string =>
  `${URL_APP}${ruta.startsWith("/") ? "" : "/"}${ruta}`;

/** El mensaje para invitar a alguien al hogar con su código de acceso, listo para mandar. */
export function mensajeDeInvitacion(codigo: string, nombre?: string): string {
  const saludo = nombre ? `Hola ${nombre} 👋 ` : "";
  return `${saludo}Únete a nuestro hogar en ¡Hecho! ✅\n1. Abre ${enlaceDeApp("/cuenta")}\n2. Entra (con tu correo o sin correo)\n3. Elige «Unirme con un código» y escribe: ${codigo}`;
}
