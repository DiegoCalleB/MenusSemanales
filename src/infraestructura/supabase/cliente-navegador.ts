import { createBrowserClient } from "@supabase/ssr";
import { envPublico } from "@/infraestructura/env";
import type { Database } from "./database.types";

/** Cliente de Supabase para componentes de cliente. Usa solo la clave publishable. */
export function crearClienteNavegador() {
  const env = envPublico();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
