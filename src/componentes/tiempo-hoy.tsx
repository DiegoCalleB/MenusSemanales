"use client";

import { lluviaDelCole } from "@/dominio/avisos";
import { type FechaIso, sumarDias } from "@/dominio/fechas";
import {
  LUGAR_TIEMPO,
  type Pronostico,
  consejosDelTiempo,
  resumenDelTiempo,
  textoDeLluviaDelCole,
} from "@/dominio/tiempo";
import { hayColeDe, tieneCole } from "@/aplicacion/cole";
import { useHogar } from "./proveedor-hogar";
import { usePrevision } from "./usar-prevision";

/**
 * El tiempo en «Hoy» (D-145): hoy y mañana de un vistazo y, si hace falta, qué ponerse o llevar.
 * Los días de cole, si llueve en la ida o la vuelta, a qué horas (D-148). Sin conexión o si la
 * previsión no llega, no ocupa sitio.
 */
export function TiempoHoy() {
  const { estado } = useHogar();
  const dias = usePrevision();

  const hayCole = hayColeDe(estado);
  const deCole = (f: FechaIso) => tieneCole(estado) && hayCole(f);
  const hoy = dias.find((d) => d.fecha === estado.hoy);
  const manana = dias.find((d) => d.fecha === sumarDias(estado.hoy, 1));
  if (!hoy && !manana) return null;

  const fila = (cuando: string, p: Pronostico) => {
    const lluvia = deCole(p.fecha) ? lluviaDelCole(p) : [];
    const consejos = consejosDelTiempo(p).filter(
      (c) => !(lluvia.length > 0 && c.clave === "lluvia"),
    );
    return (
      <li className="flex flex-col">
        <p className="text-base">
          <strong>{cuando}</strong> {resumenDelTiempo(p)}
        </p>
        {lluvia.length > 0 && (
          <p className="text-base">
            <span aria-hidden="true">🌂 </span>
            {primeraMayuscula(textoDeLluviaDelCole(lluvia))}: <strong>paraguas</strong>
          </p>
        )}
        {consejos.map((c) => (
          <p key={c.clave} className="text-base">
            <span aria-hidden="true">{c.emoji} </span>
            {c.que}: <strong>{c.llevar}</strong>
          </p>
        ))}
      </li>
    );
  };

  return (
    <section aria-labelledby="tiempo-hoy" className="tarjeta flex flex-col gap-2">
      <h2 id="tiempo-hoy" className="text-lg font-bold">
        El tiempo en {LUGAR_TIEMPO.nombre}
      </h2>
      <ul className="flex flex-col gap-2">
        {hoy && fila("Hoy", hoy)}
        {manana && fila("Mañana", manana)}
      </ul>
    </section>
  );
}

const primeraMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
