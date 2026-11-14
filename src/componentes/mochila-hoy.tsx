"use client";

import Link from "next/link";
import { hayColeDe, sinColeEntreSemana } from "@/aplicacion/cole";
import { nombreDia } from "@/aplicacion/estado";
import { sumarDias } from "@/dominio/fechas";
import { paraLlevar, paraPreparar } from "@/dominio/mochila";
import { useHogar } from "./proveedor-hogar";

/**
 * Lo de la mochila en «Hoy» (D-136): lo que hay que dejar preparado hoy, con su casilla, y lo que
 * se lleva hoy. Sin nada que enseñar no ocupa sitio (salvo con `siempre`, en su propia pantalla).
 */
export function MochilaHoy({ siempre = false }: { siempre?: boolean }) {
  const { estado, despachar } = useHogar();
  const hoy = estado.hoy;
  const nombre = (id: string) => estado.personas.find((p) => p.id === id)?.nombre ?? "";
  const hayCole = hayColeDe(estado);
  const preparar = paraPreparar(estado.mochila, hoy, hayCole);
  const llevar = paraLlevar(estado.mochila, hoy, hayCole);
  // Lo del cole que tocaría preparar hoy pero no hace falta, porque ese día no hay cole (D-144).
  const ahorradas = paraPreparar(estado.mochila, hoy).filter(
    (p) => !preparar.some((x) => x.cosa.id === p.cosa.id && x.para === p.para),
  );
  const sinColeManana = sinColeEntreSemana(estado, sumarDias(hoy, 1));
  if (!siempre && preparar.length === 0 && llevar.length === 0 && ahorradas.length === 0) {
    return null;
  }

  const cuando = (para: string) =>
    para === hoy ? "hoy" : para === sumarDias(hoy, 1) ? "mañana" : `el ${nombreDia(para)}`;
  const pendientes = preparar.filter((p) => !p.hecho).length;

  return (
    <section aria-labelledby="mochila-hoy" className="tarjeta flex flex-col gap-2">
      <h2 id="mochila-hoy" className="text-lg font-bold">
        <span aria-hidden="true">🎒 </span>
        {preparar.length > 0
          ? pendientes > 0
            ? "Hoy toca dejar preparado"
            : "Todo preparado"
          : "Qué llevar"}
      </h2>
      {preparar.length > 0 && (
        <ul aria-label="Para dejar preparado hoy" className="flex flex-col gap-1">
          {preparar.map(({ cosa, para, hecho }) => (
            <li key={`${cosa.id}-${para}`}>
              <label className="flex min-h-11 items-center gap-3 text-base">
                <input
                  type="checkbox"
                  className="size-6 shrink-0 accent-[var(--marca)]"
                  checked={hecho}
                  onChange={() => despachar({ tipo: "mochila/preparar", id: cosa.id, para })}
                />
                <span className={hecho ? "text-tinta-suave line-through" : ""}>
                  <strong>{cosa.texto}</strong> de {nombre(cosa.personaId)}
                  <span className="text-tinta-suave text-sm"> · para {cuando(para)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {llevar.length > 0 && (
        <p className="text-base">
          <strong>Hoy llevan:</strong>{" "}
          {llevar.map((c) => `${c.texto} (${nombre(c.personaId)})`).join(", ")}
        </p>
      )}
      {ahorradas.length > 0 && (
        <p className="bg-fondo rounded-2xl p-2 text-base">
          <span aria-hidden="true">🏫 </span>
          {ahorradas.map(({ cosa, para }) => {
            const motivo = sinColeEntreSemana(estado, para);
            return (
              <span key={`${cosa.id}-${para}`} className="block">
                No hace falta preparar <strong>{cosa.texto}</strong> de {nombre(cosa.personaId)}:{" "}
                {cuando(para)} no hay cole{motivo ? ` (${motivo})` : ""}.
              </span>
            );
          })}
        </p>
      )}
      {siempre && sinColeManana && ahorradas.length === 0 && (
        <p className="text-base">
          <span aria-hidden="true">🏫 </span>Mañana no hay cole: {sinColeManana}.
        </p>
      )}
      {siempre && preparar.length === 0 && llevar.length === 0 && ahorradas.length === 0 && (
        <p className="text-tinta-suave text-base">Hoy no hay nada que preparar ni que llevar.</p>
      )}
      {!siempre && (
        <Link href="/mochila" className="boton-suave w-fit">
          Ver qué llevar
        </Link>
      )}
    </section>
  );
}
