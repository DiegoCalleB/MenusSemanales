/**
 * Cabeceras de seguridad estáticas, aplicadas a todas las respuestas desde next.config.ts.
 * La CSP es dinámica (lleva nonce) y la añade src/proxy.ts.
 */
export const cabecerasSeguridad: ReadonlyArray<{ key: string; value: string }> = [
  // Solo HTTPS durante 2 años, también en subdominios.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // El navegador no "adivina" tipos de contenido (evita ejecutar subidas como scripts).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Respaldo de frame-ancestors para navegadores antiguos: nada de iframes (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // No filtrar rutas internas a otros sitios.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no necesita estos permisos del dispositivo.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Aísla la ventana de otras pestañas (protege frente a ataques entre orígenes).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
