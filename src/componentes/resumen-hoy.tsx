"use client";

import { articulosPendientes } from "@/aplicacion/estado";
import { quePideHoy } from "@/dominio/casa";
import { sumarDias } from "@/dominio/fechas";
import { abiertos } from "@/dominio/pendientes";
import { diasHasta } from "@/dominio/vencimientos";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

interface Ficha {
  id: string;
  emoji: string;
  etiqueta: string;
  n: number;
  /** Algo que mirar con prisa (lo vencido, lo importante): se pinta de aviso. */
  aviso: boolean;
}

/**
 * «De un vistazo» (D-180): cinco números arriba de la portada (citas de hoy y mañana, pendientes,
 * papeles por vencer, compra y casa). Cada uno lleva al apartado de más abajo. Si todo está a cero,
 * se entiende sin leer nada: no hay nada que pensar.
 */
export function ResumenHoy() {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const manana = sumarDias(estado.hoy, 1);
  const citas = estado.agenda.filter(
    (a) => a.fecha <= manana && (a.hasta ?? a.fecha) >= estado.hoy,
  ).length;
  const pendientes = abiertos(estado.pendientes);
  const papeles = estado.vencimientos.filter(
    (v) => v.hechoEn === null && diasHasta(v, estado.hoy) <= 30,
  );
  const comprar =
    articulosPendientes(estado).length + estado.manuales.filter((m) => !m.comprado).length;
  const casa = quePideHoy(estado.casa, estado.hoy).filter(
    (t) => t.responsableId === null || t.responsableId === yoId,
  ).length;

  const fichas: Ficha[] = [
    { id: "sec-citas", emoji: "📌", etiqueta: "Citas hoy y mañana", n: citas, aviso: false },
    {
      id: "sec-pendientes",
      emoji: "📝",
      etiqueta: "Pendientes",
      n: pendientes.length,
      aviso: pendientes.some((p) => p.importante),
    },
    {
      id: "sec-papeles",
      emoji: "📄",
      etiqueta: "Papeles por vencer",
      n: papeles.length,
      aviso: papeles.some((v) => diasHasta(v, estado.hoy) < 0),
    },
    { id: "sec-compra", emoji: "🛒", etiqueta: "Por comprar", n: comprar, aviso: false },
    { id: "sec-casa", emoji: "🏠", etiqueta: "Toca en casa", n: casa, aviso: casa > 0 },
  ];

  return (
    <ul aria-label="De un vistazo" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {fichas.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            className={`border-borde flex min-h-16 w-full flex-col items-center justify-center rounded-2xl border px-1 py-2 text-center ${f.n === 0 ? "bg-fondo text-tinta-suave" : f.aviso ? "bg-aviso-fondo text-aviso-texto" : "bg-superficie"}`}
            onClick={() =>
              document.getElementById(f.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <span className="text-xl font-extrabold tabular-nums">
              <span aria-hidden="true" className="mr-1 text-base">
                {f.emoji}
              </span>
              {f.n === 0 ? (
                <>
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">0</span>
                </>
              ) : (
                f.n
              )}
            </span>
            <span className="text-xs leading-tight font-semibold">{f.etiqueta}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
