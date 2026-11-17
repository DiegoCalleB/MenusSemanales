"use client";

import Link from "next/link";
import { diasHasta, emojiDe, estadoDe, paraHoy, textoCuando } from "@/dominio/vencimientos";
import { useHogar } from "./proveedor-hogar";

const MAX_EN_HOY = 3;

/**
 * Los papeles que vencen pronto, en «Hoy» (D-174): lo vencido y lo de las dos próximas semanas.
 * Como mucho tres, para no llenar la portada; el resto, en «Papeles».
 */
export function PapelesHoy() {
  const { estado } = useHogar();
  const lista = paraHoy(estado.vencimientos, estado.hoy);
  if (lista.length === 0) return null;
  const vista = lista.slice(0, MAX_EN_HOY);

  return (
    <section aria-labelledby="papeles-hoy" className="tarjeta flex flex-col gap-2">
      <h2 id="papeles-hoy" className="text-lg font-bold">
        <span aria-hidden="true">📄 </span>Papeles por vencer
      </h2>
      <ul className="flex flex-col gap-1">
        {vista.map((v) => {
          const e = estadoDe(v, estado.hoy);
          const de = v.personaId ? estado.personas.find((p) => p.id === v.personaId)?.nombre : null;
          return (
            <li key={v.id} className="text-base">
              <span aria-hidden="true">{emojiDe(v.categoria)} </span>
              <strong>
                {v.titulo}
                {de ? ` de ${de}` : ""}
              </strong>{" "}
              <span
                className={
                  e === "vencido" ? "text-peligro-texto font-semibold" : "text-tinta-suave"
                }
              >
                · {textoCuando(diasHasta(v, estado.hoy))}
              </span>
            </li>
          );
        })}
      </ul>
      <Link href="/papeles" className="boton-suave w-fit">
        {lista.length > MAX_EN_HOY ? `Ver los ${lista.length}` : "Ver papeles"}
      </Link>
    </section>
  );
}
