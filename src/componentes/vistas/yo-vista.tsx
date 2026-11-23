"use client";

import Link from "next/link";
import { CuidarseHoy } from "../cuidarse-hoy";
import { MiDiaHoy } from "../mi-dia-hoy";
import { NotasHoy } from "../notas-hoy";
import { ObjetivosHoy } from "../objetivos-hoy";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

/**
 * «Yo» (D-206): el espacio personal en un solo sitio. Mi día, cuidarse, objetivos y notas, y los
 * avisos. Es solo de quien tiene el móvil: no lo ve nadie más de la familia.
 */
export function YoVista() {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {yo ? `${yo.nombre}, lo tuyo` : "Yo"} <span aria-hidden="true">🙋</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Tu día, tus objetivos y tus notas. Es solo tuyo: el resto de la familia no lo ve.
        </p>
      </header>

      {!yo ? (
        <p className="tarjeta text-base">Elige quién eres (en «Familia») para ver tu espacio.</p>
      ) : (
        <>
          <MiDiaHoy />
          <CuidarseHoy />
          <ObjetivosHoy />
          <NotasHoy />
          <nav aria-label="Lo tuyo" className="flex flex-wrap gap-2">
            <Link href="/objetivos" className="boton-suave">
              <span aria-hidden="true">🎯 </span>Objetivos
            </Link>
            <Link href="/notas" className="boton-suave">
              <span aria-hidden="true">💡 </span>Notas e ideas
            </Link>
            <Link href="/avisos" className="boton-suave">
              <span aria-hidden="true">🔔 </span>Mis avisos
            </Link>
          </nav>
        </>
      )}
    </div>
  );
}
