/**
 * Content Security Policy estricta basada en nonce (ver docs/seguridad.md).
 *
 * - Solo se ejecutan scripts con el nonce de la petición; `strict-dynamic` permite que esos
 *   scripts carguen los fragmentos de Next sin abrir la puerta a scripts inyectados.
 * - `connect-src` limita las conexiones a la propia app y a Supabase (HTTPS y WebSocket para
 *   Realtime). Si no hay URL de Supabase configurada, la política es aún más estricta.
 * - `unsafe-eval` solo en desarrollo (React lo usa para depurar; nunca en producción).
 */
export interface OpcionesCsp {
  nonce: string;
  supabaseUrl?: string;
  esDesarrollo: boolean;
}

export function construirCsp({ nonce, supabaseUrl, esDesarrollo }: OpcionesCsp): string {
  if (!/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) {
    throw new Error("Nonce de CSP inválido");
  }

  const conexiones = ["'self'"];
  if (supabaseUrl) {
    const { host, protocol } = new URL(supabaseUrl);
    if (protocol !== "https:" && !esDesarrollo) {
      throw new Error("En producción, Supabase debe usarse por HTTPS");
    }
    conexiones.push(`${protocol}//${host}`, `${protocol === "https:" ? "wss" : "ws"}://${host}`);
  }

  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(esDesarrollo ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", `'nonce-${nonce}'`],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    "connect-src": conexiones,
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const politica = Object.entries(directivas).map(
    ([clave, valores]) => `${clave} ${valores.join(" ")}`,
  );
  if (!esDesarrollo) politica.push("upgrade-insecure-requests");
  return politica.join("; ");
}

/** Nonce criptográficamente aleatorio (128 bits) en base64. */
export function generarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
