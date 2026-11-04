/** Lo que se le dice a la persona cuando la IA no puede (los códigos los pone el servidor). */
const MENSAJES: Record<string, string> = {
  "ia-no-configurada": "La IA todavía no está activada en esta instalación.",
  "tope-diario": "Hoy ya habéis usado todas las consultas de IA. Mañana se renuevan.",
  "sin-sesion": "Entra en tu cuenta (Más → Cuenta) para usar la IA.",
  "sin-hogar": "Primero crea o únete a un hogar (Más → Cuenta).",
  "demasiado-grande": "El archivo es demasiado grande (máximo 8 MB).",
  "tipo-no-valido": "Solo se admiten PDF o fotos (PNG, JPG o WEBP).",
  "peticion-invalida": "No he entendido lo que se envió. Revisa el texto o el archivo.",
};

export function mensajeDeIa(
  cuerpo: { error?: string; motivo?: string } | null | undefined,
): string {
  const conocido = cuerpo?.error ? MENSAJES[cuerpo.error] : undefined;
  if (conocido) return conocido;
  return `La IA no está disponible ahora. Inténtalo luego.${cuerpo?.motivo ? ` (${cuerpo.motivo})` : ""}`;
}
