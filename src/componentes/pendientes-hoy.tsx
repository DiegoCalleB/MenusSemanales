"use client";

import Link from "next/link";
import { abiertos, deLaPersona, paraHoy, textoEspera } from "@/dominio/pendientes";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

/**
 * Los pendientes sin fecha, en «Hoy» (D-175): lo importante y lo que más lleva esperando, de quien
 * tiene el móvil y de nadie en concreto. Como mucho tres; el resto, en «Pendientes».
 */
export function PendientesHoy() {
  const { estado, despachar } = useHogar();
  const [yo] = useYo();
  const vista = paraHoy(estado.pendientes, yo);
  if (vista.length === 0) return null;
  const total = abiertos(deLaPersona(estado.pendientes, yo)).length;

  return (
    <section aria-labelledby="pendientes-hoy" className="tarjeta flex flex-col gap-2">
      <h2 id="pendientes-hoy" className="text-lg font-bold">
        <span aria-hidden="true">📝 </span>Pendientes
      </h2>
      <ul className="flex flex-col gap-1">
        {vista.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked="false"
              aria-label={`Hecho: ${p.texto}`}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-base"
              onClick={() => despachar({ tipo: "pendiente/hecho", id: p.id, hecho: true })}
            >
              <span aria-hidden="true">⬜</span>
              <span>
                {p.importante && <span aria-hidden="true">⭐ </span>}
                {p.texto}{" "}
                <span className="text-tinta-suave text-sm">
                  · {textoEspera(p.creadoEn, estado.hoy)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Link href="/pendientes" className="boton-suave w-fit">
        {total > vista.length ? `Ver los ${total}` : "Ver pendientes"}
      </Link>
    </section>
  );
}
