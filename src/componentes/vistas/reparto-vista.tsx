"use client";

import { useId } from "react";
import { repartoDeLaSemana } from "@/aplicacion/estado";
import type { CargaDePersona } from "@/dominio/reparto";
import { formatearNumero } from "../formato";
import { IconoAlerta } from "../iconos";
import { useHogar } from "../proveedor-hogar";

const fechaLarga = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const nombreDia = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  return fechaLarga.format(new Date(Date.UTC(a, m - 1, d)));
};

/**
 * Barras apiladas horizontales: cada fila es una persona y cada barra, sus minutos de la semana
 * divididos en ejecutar y organizar. Dos series, así que color + leyenda + etiquetas directas.
 * Las anchuras son atributos SVG (no `style`): la CSP no permite estilos en línea.
 */
function Grafico({ filas, nombres }: { filas: CargaDePersona[]; nombres: Map<string, string> }) {
  const maximo = Math.max(1, ...filas.map((f) => f.totalMin));
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-base" aria-label="Leyenda">
        <li className="flex items-center gap-2">
          <span className="bg-serie-1 size-3.5 rounded-sm" aria-hidden="true" />
          Ejecutar <span className="text-tinta-suave">(cocinar, comprar…)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="bg-serie-2 size-3.5 rounded-sm" aria-hidden="true" />
          Organizar <span className="text-tinta-suave">(acordarse, decidir)</span>
        </li>
      </ul>

      <ul className="flex flex-col gap-5">
        {filas.map((f) => {
          const nombre = nombres.get(f.personaId) ?? f.personaId;
          const pctEjecucion = (f.ejecucionMin / maximo) * 100;
          const pctTotal = (f.totalMin / maximo) * 100;
          const hayOrganizar = f.planificacionMin > 0;
          const hayEjecutar = f.ejecucionMin > 0;
          const colorBase = hayOrganizar ? "var(--serie-2)" : "var(--serie-1)";
          const resumen = `${nombre}: ${f.ejecucionMin} minutos ejecutando y ${f.planificacionMin} organizando, ${f.totalMin} en total`;
          return (
            <li key={f.personaId}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold">{nombre}</span>
                <span className="text-base tabular-nums">
                  <strong>{formatearNumero(f.totalMin)} min</strong> ·{" "}
                  {formatearNumero(f.porcentaje)} %
                </span>
              </div>
              <svg role="img" aria-label={resumen} width="100%" height="24" className="mt-1 block">
                <title>{resumen}</title>
                <rect
                  x="0"
                  y="4"
                  width="100%"
                  height="16"
                  rx="4"
                  fill="var(--borde)"
                  opacity="0.5"
                />
                {f.totalMin > 0 && (
                  <>
                    <rect x="0" y="4" width={`${pctTotal}%`} height="16" rx="4" fill={colorBase} />
                    {!hayEjecutar && <rect x="0" y="4" width="8" height="16" fill={colorBase} />}
                    {hayEjecutar && (
                      <rect
                        x="0"
                        y="4"
                        width={`${pctEjecucion}%`}
                        height="16"
                        fill="var(--serie-1)"
                      />
                    )}
                    {hayEjecutar && hayOrganizar && (
                      <rect
                        x={`${pctEjecucion}%`}
                        y="4"
                        width="2"
                        height="16"
                        fill="var(--superficie)"
                        transform="translate(-1 0)"
                      />
                    )}
                  </>
                )}
              </svg>
              <p className="text-tinta-suave mt-1 text-sm tabular-nums">
                Ejecutar {formatearNumero(f.ejecucionMin)} min · Organizar{" "}
                {formatearNumero(f.planificacionMin)} min
              </p>
            </li>
          );
        })}
      </ul>

      <details className="border-borde rounded-xl border">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-base font-medium">
          Ver como tabla
        </summary>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-72 text-left text-base">
            <caption className="sr-only">Minutos de cada persona esta semana</caption>
            <thead>
              <tr className="border-borde border-b">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Persona
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Ejecutar
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Organizar
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Total
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.personaId} className="border-borde border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {nombres.get(f.personaId)}
                  </th>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatearNumero(f.ejecucionMin)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatearNumero(f.planificacionMin)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatearNumero(f.totalMin)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatearNumero(f.porcentaje)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function RepartoVista() {
  const { estado, despachar } = useHogar();
  const idBase = useId();
  const reparto = repartoDeLaSemana(estado);
  const adultas = estado.personas.filter((p) => p.tipo === "adulto" && p.activa);
  const nombres = new Map(estado.personas.map((p) => [p.id, p.nombre]));
  const cargas = estado.cargas.filter((c) => c.activa);
  const cargaPorId = new Map(estado.cargas.map((c) => [c.id, c]));

  const diaMasTemprano = [...estado.turnos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const dias = [...new Set(diaMasTemprano.map((t) => t.fecha))];

  const mensaje =
    reparto.diferenciaPuntos <= 10
      ? "Esta semana el reparto es parejo."
      : `Esta semana hay ${formatearNumero(reparto.diferenciaPuntos)} puntos de diferencia entre personas. Puede ser lo que habéis acordado; si no, se puede repartir de otra forma.`;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Reparto <span aria-hidden="true">🤝</span>
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="carga" className="tarjeta flex flex-col gap-3">
          <h2 id="carga" className="text-lg font-semibold">
            Carga de cada persona
          </h2>
          <Grafico filas={reparto.personas} nombres={nombres} />
          <p className="text-base" role="status">
            {mensaje}
          </p>
          <button
            type="button"
            className="boton w-full sm:w-auto"
            onClick={() => despachar({ tipo: "reparto/proponerRotacion" })}
          >
            Proponer un reparto más parejo
          </button>
        </section>

        <div className="flex flex-col gap-4">
          {reparto.sinResponsable.length > 0 && (
            <section
              aria-labelledby="sin"
              className="tarjeta border-aviso-texto/30 bg-aviso-fondo text-aviso-texto py-3"
            >
              <h2 id="sin" className="flex items-center gap-2 text-base font-semibold">
                <IconoAlerta width={20} height={20} />
                Sin responsable
              </h2>
              <p className="text-base">
                {reparto.sinResponsable.map((c) => c.nombre).join(", ")}. Si nadie se encarga, nadie
                se acuerda.
              </p>
            </section>
          )}

          <details className="tarjeta py-0">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-2 text-lg font-semibold">
              <h2>Turnos de la semana</h2>
              <span className="text-tinta-suave text-base font-normal">{estado.turnos.length}</span>
            </summary>
            <ol className="flex flex-col gap-3 pb-4">
              {dias.map((dia) => (
                <li key={dia}>
                  <h3 className="text-base font-semibold capitalize">{nombreDia(dia)}</h3>
                  <ul className="mt-1 flex flex-col">
                    {estado.turnos
                      .filter((t) => t.fecha === dia)
                      .map((t) => {
                        const hecho = t.estado === "hecho";
                        return (
                          <li
                            key={`${t.cargaId}-${t.fecha}`}
                            className="flex min-h-11 items-center justify-between gap-3"
                          >
                            <span
                              className={`min-w-0 text-base ${hecho ? "text-tinta-suave line-through" : ""}`}
                            >
                              {cargaPorId.get(t.cargaId)?.nombre} ·{" "}
                              <strong>{nombres.get(t.personaId)}</strong>
                            </span>
                            <button
                              type="button"
                              className="boton-suave shrink-0"
                              aria-pressed={hecho}
                              onClick={() =>
                                despachar({
                                  tipo: "reparto/estadoTurno",
                                  cargaId: t.cargaId,
                                  fecha: t.fecha,
                                  estado: hecho ? "pendiente" : "hecho",
                                })
                              }
                            >
                              {hecho ? "Hecho ✓" : "Marcar hecho"}
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </div>

      <section aria-labelledby="cargas" className="tarjeta flex flex-col gap-2">
        <h2 id="cargas" className="text-lg font-semibold">
          Quién se encarga de cada cosa
        </h2>
        <ul className="divide-borde divide-y">
          {cargas.map((c) => {
            const id = `${idBase}-${c.id}`;
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <h3 className="text-base leading-snug font-semibold">{c.nombre}</h3>
                  <p className="text-tinta-suave text-sm">
                    {c.esfuerzoMin} min
                    {c.planificacionMin > 0 ? ` + ${c.planificacionMin} organizando` : ""}
                  </p>
                </div>
                <label htmlFor={id} className="sr-only">
                  Responsable de {c.nombre}
                </label>
                <select
                  id={id}
                  className="campo w-36 shrink-0"
                  value={c.responsableId ?? ""}
                  onChange={(e) =>
                    despachar({
                      tipo: "reparto/asignarResponsable",
                      cargaId: c.id,
                      personaId: e.target.value === "" ? null : e.target.value,
                    })
                  }
                >
                  <option value="">Sin asignar</option>
                  {adultas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
