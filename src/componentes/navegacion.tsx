"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { IconoCompra, IconoDespensa, IconoMenu, IconoReparto } from "./iconos";

const ENLACES: ReadonlyArray<{
  href: string;
  texto: string;
  Icono: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  { href: "/menu", texto: "Menú", Icono: IconoMenu },
  { href: "/compra", texto: "Compra", Icono: IconoCompra },
  { href: "/despensa", texto: "Despensa", Icono: IconoDespensa },
  { href: "/reparto", texto: "Reparto", Icono: IconoReparto },
];

const activo = (ruta: string, href: string) => ruta === href || ruta.startsWith(`${href}/`);

/** Móvil: barra de pestañas fija abajo, al alcance del pulgar y respetando la zona segura del iPhone. */
export function NavegacionInferior() {
  const ruta = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="border-borde bg-superficie fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ENLACES.map(({ href, texto, Icono }) => {
          const esActivo = activo(ruta, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={esActivo ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-2 text-[0.8125rem] leading-tight ${
                  esActivo ? "text-marca font-bold" : "text-tinta-suave font-medium"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full ${esActivo ? "bg-suave-1" : ""}`}
                >
                  <Icono />
                </span>
                {texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tablet y escritorio: barra lateral con el nombre de la app y las secciones. */
export function NavegacionLateral() {
  const ruta = usePathname();
  return (
    <aside className="border-borde bg-superficie sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-6 border-r p-4 md:flex lg:w-64">
      <Link
        href="/"
        className="mt-2 flex items-center gap-3 px-2 text-xl font-extrabold tracking-tight"
      >
        <span
          aria-hidden="true"
          className="bg-suave-1 flex size-10 items-center justify-center rounded-2xl text-2xl"
        >
          🍽️
        </span>
        <span className="text-marca">Menús Semanales</span>
      </Link>
      <nav aria-label="Principal">
        <ul className="flex flex-col gap-1">
          {ENLACES.map(({ href, texto, Icono }) => {
            const esActivo = activo(ruta, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={esActivo ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-base ${
                    esActivo
                      ? "bg-suave-1 text-marca-fuerte font-bold"
                      : "text-tinta hover:bg-fondo font-medium"
                  }`}
                >
                  <Icono />
                  {texto}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="text-tinta-suave mt-auto px-2 text-sm">
        Modo prueba: datos de ejemplo guardados solo en este dispositivo.
      </p>
    </aside>
  );
}
