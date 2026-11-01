import type { AlmacenHogar } from "@/aplicacion/almacen";
import type { EstadoHogar } from "@/aplicacion/estado";

/** Súbela cuando cambie la forma del estado: lo guardado con otra versión se descarta. */
export const VERSION_ALMACEN = 5;
const CLAVE = "menus-semanales:prueba";

const COLECCIONES = [
  "ingredientes",
  "platos",
  "personas",
  "despensa",
  "comidas",
  "manuales",
  "compras",
  "operaciones",
  "cargas",
  "turnos",
  "ocurrencias",
  "excluirIngredientes",
  "llegoTarde",
  "saltados",
] as const;

/** Comprobación estructural mínima: lo guardado es del propio usuario, pero puede ser antiguo o estar roto. */
export function esEstadoValido(dato: unknown): dato is EstadoHogar {
  if (typeof dato !== "object" || dato === null) return false;
  const e = dato as Record<string, unknown>;
  return (
    typeof e.hoy === "string" &&
    typeof e.siguienteId === "number" &&
    (e.horizonte === "semana" || e.horizonte === "quincena") &&
    typeof e.eventos === "object" &&
    e.eventos !== null &&
    typeof e.valoraciones === "object" &&
    e.valoraciones !== null &&
    typeof e.colegio === "object" &&
    e.colegio !== null &&
    COLECCIONES.every((c) => Array.isArray(e[c]))
  );
}

/** Almacén en el navegador (localStorage). Nunca lanza: si no está disponible, la app sigue sin guardar. */
export function crearAlmacenLocal(
  almacenamiento: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null,
): AlmacenHogar {
  return {
    cargar() {
      try {
        const texto = almacenamiento?.getItem(CLAVE);
        if (!texto) return null;
        const guardado = JSON.parse(texto) as { version?: unknown; estado?: unknown };
        if (guardado.version !== VERSION_ALMACEN || !esEstadoValido(guardado.estado)) return null;
        return { ...guardado.estado, aviso: null };
      } catch {
        return null;
      }
    },
    guardar(estado) {
      try {
        almacenamiento?.setItem(
          CLAVE,
          JSON.stringify({ version: VERSION_ALMACEN, estado: { ...estado, aviso: null } }),
        );
      } catch {
        // Sin espacio o en modo privado: se sigue funcionando sin guardar.
      }
    },
    borrar() {
      try {
        almacenamiento?.removeItem(CLAVE);
      } catch {
        // nada que hacer
      }
    },
  };
}
