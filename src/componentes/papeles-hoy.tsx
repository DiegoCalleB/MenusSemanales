"use client";

import { type Vencimiento, diasHasta, emojiDe, textoCuando } from "@/dominio/vencimientos";
import { useHogar } from "./proveedor-hogar";
import { SeccionHoy, Vacio } from "./seccion-hoy";

const MAX_EN_HOY = 4;

/**
 * Los papeles que vencen pronto, siempre en «Hoy» (D-174, D-180): lo ya vencido y lo de los próximos
 * 30 días, lo más urgente primero. Sin nada, dice que está todo al día.
 */
export function PapelesHoy() {
  const { estado } = useHogar();
  const lista = estado.vencimientos
    .filter((v) => v.hechoEn === null && diasHasta(v, estado.hoy) <= 30)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, "es"));
  const vista = lista.slice(0, MAX_EN_HOY);
  const vencidos = lista.filter((v) => diasHasta(v, estado.hoy) < 0).length;
  const de = (v: Vencimiento) =>
    v.personaId ? estado.personas.find((p) => p.id === v.personaId)?.nombre : null;

  return (
    <SeccionHoy
      id="sec-papeles"
      compacta={vista.length === 0}
      emoji="📄"
      titulo="Papeles por vencer"
      cuenta={lista.length}
      urgente={vencidos > 0}
      enlace={{
        href: "/papeles",
        texto: lista.length > MAX_EN_HOY ? `Ver los ${lista.length}` : "Ver papeles",
      }}
    >
      {vista.length === 0 ? (
        <Vacio>Todo al día ✅ Nada vence en los próximos 30 días.</Vacio>
      ) : (
        <ul className="flex flex-col gap-1">
          {vista.map((v) => {
            const dias = diasHasta(v, estado.hoy);
            return (
              <li key={v.id} className="text-base">
                <span aria-hidden="true">{emojiDe(v.categoria)} </span>
                <strong>
                  {v.titulo}
                  {de(v) ? ` de ${de(v)}` : ""}
                </strong>{" "}
                <span
                  className={dias < 0 ? "text-peligro-texto font-semibold" : "text-tinta-suave"}
                >
                  · {textoCuando(dias)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SeccionHoy>
  );
}
