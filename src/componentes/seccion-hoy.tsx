import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Un apartado fijo de la portada «Hoy» (D-180), con el mismo aspecto siempre: icono, título, cuántos
 * hay y un enlace para ir a gestionarlo. Así la portada es un tablero que se aprende de un vistazo:
 * cada cosa está siempre en su sitio, haya algo o no.
 */
export function SeccionHoy({
  id,
  emoji,
  titulo,
  cuenta,
  urgente = false,
  enlace,
  children,
}: {
  /** Para llevar hasta aquí desde el resumen («sec-pendientes»). */
  id: string;
  emoji: string;
  titulo: string;
  cuenta?: number;
  /** Pinta la cuenta de aviso (algo vencido, algo importante). */
  urgente?: boolean;
  enlace?: { href: string; texto: string };
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-t`}
      className="tarjeta flex scroll-mt-20 flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-t`} className="text-lg font-extrabold">
          <span aria-hidden="true">{emoji} </span>
          {titulo}
          {cuenta !== undefined && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-sm font-bold tabular-nums ${urgente && cuenta > 0 ? "bg-peligro-fondo text-peligro-texto" : "bg-suave-1 text-tinta-suave"}`}
            >
              {cuenta}
            </span>
          )}
        </h2>
        {enlace && (
          <Link
            href={enlace.href}
            className="text-marca-fuerte -my-1 inline-flex min-h-11 items-center px-1 text-sm font-semibold underline"
          >
            {enlace.texto}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** El texto de cuando un apartado no tiene nada: tranquilo, no un hueco. */
export function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-tinta-suave text-base">{children}</p>;
}
