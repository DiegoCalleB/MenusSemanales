"use client";

import Link from "next/link";
import { useHogar } from "./proveedor-hogar";
import { usePlanesDelBarrio } from "./usar-barrio";

/**
 * Una línea en Fechas (D-167) que lleva a la pantalla de planes del barrio. No lista nada: así
 * «Próximas fechas» no se llena. Sin planes (o sin conexión), no sale.
 */
export function PlanesDelBarrio() {
  const { estado } = useHogar();
  const planes = usePlanesDelBarrio();
  const vigentes = planes.filter((p) => (p.hasta ?? p.fecha) >= estado.hoy);
  if (vigentes.length === 0) return null;
  const familia = vigentes.filter((p) => p.familiar).length;
  return (
    <Link href="/barrio" className="tarjeta flex min-h-11 items-center justify-between gap-2">
      <span className="text-base font-semibold">
        <span aria-hidden="true">🏘️ </span>Planes del barrio
        <span className="text-tinta-suave font-medium">
          {" "}
          · {vigentes.length}
          {familia > 0 ? ` (${familia} para la familia)` : ""}
        </span>
      </span>
      <span aria-hidden="true" className="text-xl">
        ›
      </span>
    </Link>
  );
}
