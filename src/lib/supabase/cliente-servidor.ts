import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { envPublico } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Actúa con la sesión del usuario (cookies), por lo que la RLS se aplica igual que en el cliente.
 */
export async function crearClienteServidor() {
  const env = envPublico();
  const almacen = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (lista) => {
          try {
            for (const { name, value, options } of lista) almacen.set(name, value, options);
          } catch {
            // En un Server Component no se pueden escribir cookies; el refresco de sesión
            // lo hará el proxy de autenticación (fase 3).
          }
        },
      },
    },
  );
}
