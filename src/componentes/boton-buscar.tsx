"use client";

import Link from "next/link";

/** La lupa de la cabecera (D-177): lleva al buscador de todo el hogar. */
export function BotonBuscar() {
  return (
    <Link href="/buscar" className="boton-suave px-3" title="Buscar">
      <span aria-hidden="true">🔍</span>
      <span className="sr-only">Buscar</span>
    </Link>
  );
}
