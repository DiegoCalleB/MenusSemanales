import { type NextRequest, NextResponse } from "next/server";
import { construirCsp, generarNonce } from "@/infraestructura/seguridad/csp";

/**
 * Añade una CSP con nonce único por petición. Next.js lee el nonce de la cabecera y lo aplica a
 * sus propios scripts. La autorización NO se hace aquí: se comprueba en la capa de acceso a datos
 * y en cada Server Action (ver docs/seguridad.md).
 */
export function proxy(request: NextRequest) {
  const nonce = generarNonce();
  const csp = construirCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    esDesarrollo: process.env.NODE_ENV === "development",
  });

  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-nonce", nonce);
  cabeceras.set("Content-Security-Policy", csp);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  matcher: [
    {
      // Todo excepto recursos estáticos, que no ejecutan código.
      source: "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
