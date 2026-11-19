"use client";

import { avisosDelEstado } from "@/aplicacion/avisos";
import { comidasDe } from "@/aplicacion/estado";
import { quePideHoy } from "@/dominio/casa";
import { dejarPreparadoDe, fraseDeHoy } from "@/dominio/frase-hoy";
import { diasHasta } from "@/dominio/cumples";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

/** La frase de arriba de «Hoy» (D-190): lo importante del día en una línea. */
export function FraseDeHoy() {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const frase = fraseDeHoy({
    hoy: estado.hoy,
    cumples: estado.cumples.filter((c) => diasHasta(c, estado.hoy) === 0).map((c) => c.nombre),
    citas: estado.agenda
      .filter((a) => a.fecha <= estado.hoy && (a.hasta ?? a.fecha) >= estado.hoy)
      .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""))
      .map((a) => ({ titulo: a.titulo, hora: a.hora })),
    dejarPreparado: dejarPreparadoDe(avisosDelEstado(estado)),
    casa: quePideHoy(estado.casa, estado.hoy).filter(
      (t) => t.responsableId === null || t.responsableId === yoId,
    ).length,
    cena: comidasDe(estado, estado.hoy).map((c) => c.plato.nombre),
  });
  return <p className="px-1 text-base font-semibold">{frase}</p>;
}
