"use client";

import Link from "next/link";
import { hayColeDe, sinColeEntreSemana, tieneCole } from "@/aplicacion/cole";
import { comidasDe } from "@/aplicacion/estado";
import { sumarDias } from "@/dominio/fechas";
import { useHogar } from "./proveedor-hogar";
import { SeccionHoy } from "./seccion-hoy";

const DIA = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", timeZone: "UTC" });

/**
 * «Mañana» (D-180), siempre en la portada: la cena (o que falta elegirla), si hay cole y sus citas.
 * Así, de un vistazo, se sabe qué queda por decidir para mañana sin abrir nada más.
 */
export function MananaHoy() {
  const { estado } = useHogar();
  const manana = sumarDias(estado.hoy, 1);
  const cenas = comidasDe(estado, manana);
  const sinCena = estado.saltados.includes(manana);
  const citas = estado.agenda
    .filter((a) => a.fecha <= manana && (a.hasta ?? a.fecha) >= manana)
    .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
  const conCole = tieneCole(estado);
  const hayCole = conCole && hayColeDe(estado)(manana);
  const motivoSinCole = conCole ? sinColeEntreSemana(estado, manana) : null;
  const dia = DIA.format(new Date(`${manana}T12:00:00Z`));

  return (
    <SeccionHoy id="sec-manana" emoji="🌙" titulo={`Mañana · ${dia}`}>
      <ul className="flex flex-col gap-1 text-base">
        <li>
          <span aria-hidden="true">🍽️ </span>
          {sinCena ? (
            "No se cena en casa"
          ) : cenas.length > 0 ? (
            <>
              <strong>Cena:</strong> {cenas.map((c) => c.plato.nombre).join(" + ")}
            </>
          ) : (
            <>
              <strong>Cena:</strong> aún sin elegir{" "}
              <Link href="/menu" className="text-marca-fuerte font-semibold underline">
                Elegir
              </Link>
            </>
          )}
        </li>
        {conCole && (
          <li>
            <span aria-hidden="true">🏫 </span>
            {hayCole ? (
              <>Hay cole</>
            ) : motivoSinCole ? (
              <>
                <strong>Sin cole:</strong> {motivoSinCole}
              </>
            ) : (
              <>Fin de semana: sin cole</>
            )}
          </li>
        )}
        {citas.length === 0 ? (
          <li className="text-tinta-suave">
            <span aria-hidden="true">📌 </span>Sin citas
          </li>
        ) : (
          citas.map((a) => (
            <li key={a.id}>
              <span aria-hidden="true">📌 </span>
              {a.hora ? `${a.hora} · ` : ""}
              {a.titulo}
            </li>
          ))
        )}
      </ul>
    </SeccionHoy>
  );
}
