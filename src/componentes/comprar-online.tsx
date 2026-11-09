"use client";

import { SUPERMERCADOS, enlaceDeBusqueda } from "@/dominio/supermercado";

export interface ArticuloOnline {
  clave: string;
  nombre: string;
  cantidad: string;
}

/**
 * Pasar la lista pendiente a la tienda online del supermercado: cada artículo abre su búsqueda en
 * una pestaña nueva y se añade a la cesta con la cuenta de la propia persona (D-127). La app no
 * compra por vosotros ni guarda contraseñas: los supermercados no ofrecen API para eso.
 */
export function ComprarOnline({ articulos }: { articulos: readonly ArticuloOnline[] }) {
  const super_ = SUPERMERCADOS[0];
  if (!super_ || articulos.length === 0) return null;
  return (
    <details className="tarjeta p-0">
      <summary className="flex min-h-14 cursor-pointer items-center gap-2 px-4 py-2 text-lg font-extrabold">
        <span aria-hidden="true">🛍️</span> Comprar online en {super_.nombre}
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-tinta-suave text-base">
          Toca cada artículo: se abre su búsqueda en {super_.nombre}. Lo añades a la cesta y vuelves
          aquí. La app no compra por ti ni guarda tu contraseña.
        </p>
        <a
          className="boton-suave w-fit"
          href={super_.tienda}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir la tienda de {super_.nombre} ↗
        </a>
        <ul aria-label={`Buscar en ${super_.nombre}`} className="flex flex-col gap-2">
          {articulos.map((a) => (
            <li
              key={a.clave}
              className="border-borde bg-fondo flex items-center justify-between gap-3 rounded-2xl border p-2 pl-3"
            >
              <span className="min-w-0 text-base font-semibold">
                {a.nombre}
                {a.cantidad && (
                  <span className="text-tinta-suave font-normal"> · {a.cantidad}</span>
                )}
              </span>
              <a
                className="boton-suave shrink-0"
                href={enlaceDeBusqueda(super_, a.nombre)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Buscar ${a.nombre} en ${super_.nombre}`}
              >
                Buscar ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
