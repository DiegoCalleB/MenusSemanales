"use client";

import Link from "next/link";
import { cuidadoDe } from "@/dominio/cuidado";
import { fechaLegible } from "@/aplicacion/buscar";
import { repasoDeLaSemana } from "@/dominio/repaso";
import { textoEspera } from "@/dominio/pendientes";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * La revisión de la semana (D-191): dos minutos para ver qué se hizo, qué se quedó y qué viene, y
 * dejar la siguiente semana encarrilada. Se mira el domingo desde «Hoy», o cuando se quiera.
 */
export function RepasoVista() {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  const r = repasoDeLaSemana({
    hoy: estado.hoy,
    casa: estado.casa,
    pendientes: estado.pendientes,
    cuidado: yo ? cuidadoDe(estado.cuidado, yo.id) : null,
    agenda: estado.agenda,
    vencimientos: estado.vencimientos,
    cumples: estado.cumples,
  });
  const nadaHecho =
    r.hecho.casa.length === 0 &&
    r.hecho.pendientes.length === 0 &&
    !r.hecho.miDia &&
    !r.hecho.agua &&
    !r.hecho.ejercicio;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Revisión de la semana <span aria-hidden="true">🔎</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Dos minutos: lo que hiciste, lo que se quedó y lo que viene.
        </p>
      </header>

      <section aria-labelledby="rv-hecho" className="tarjeta flex flex-col gap-2">
        <h2 id="rv-hecho" className="text-lg font-extrabold">
          <span aria-hidden="true">✅ </span>Lo que hiciste
        </h2>
        {nadaHecho && (
          <p className="text-tinta-suave text-base">
            Esta semana no hay nada marcado todavía. ¡Empieza por «Mi día» en Hoy!
          </p>
        )}
        {r.hecho.casa.length > 0 && (
          <p className="text-base">
            <strong>En casa:</strong> {r.hecho.casa.join(", ")}.
          </p>
        )}
        {r.hecho.pendientes.length > 0 && (
          <p className="text-base">
            <strong>Pendientes hechos:</strong> {r.hecho.pendientes.join(", ")}.
          </p>
        )}
        {r.hecho.miDia && (
          <p className="text-base">
            <strong>Mi día:</strong> lista completa {plural(r.hecho.miDia.completos, "día", "días")}{" "}
            de {r.hecho.miDia.dias}.
          </p>
        )}
        {r.hecho.agua && (
          <p className="text-base">
            <strong>Agua:</strong> meta cumplida {plural(r.hecho.agua.cumplidos, "día", "días")}.
          </p>
        )}
        {r.hecho.ejercicio && (
          <p className="text-base">
            <strong>Ejercicio:</strong> {r.hecho.ejercicio.hechas} de {r.hecho.ejercicio.objetivo}{" "}
            sesiones.
          </p>
        )}
      </section>

      <section aria-labelledby="rv-quedo" className="tarjeta flex flex-col gap-2">
        <h2 id="rv-quedo" className="text-lg font-extrabold">
          <span aria-hidden="true">📝 </span>Lo que se quedó
        </h2>
        {r.quedo.pendientesViejos.length === 0 ? (
          <p className="text-tinta-suave text-base">
            Ningún pendiente lleva una semana esperando
            {r.quedo.totalPendientes > 0
              ? ` (hay ${plural(r.quedo.totalPendientes, "abierto", "abiertos")}).`
              : ". ¡Limpio!"}
          </p>
        ) : (
          <ul aria-label="Pendientes que llevan esperando" className="flex flex-col gap-1">
            {r.quedo.pendientesViejos.map((p) => (
              <li key={p.texto} className="text-base">
                {p.importante ? "⭐ " : ""}
                {p.texto}{" "}
                <span className="text-tinta-suave text-sm">
                  ({textoEspera(p.creadoEn, estado.hoy)})
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/fechas#sin-fecha"
          className="text-marca-fuerte inline-flex min-h-11 items-center text-base font-semibold underline"
        >
          Ver todos los pendientes
        </Link>
      </section>

      <section aria-labelledby="rv-viene" className="tarjeta flex flex-col gap-2">
        <h2 id="rv-viene" className="text-lg font-extrabold">
          <span aria-hidden="true">🗓️ </span>Lo que viene
        </h2>
        {r.viene.citas.length === 0 &&
        r.viene.papeles.length === 0 &&
        r.viene.cumples.length === 0 ? (
          <p className="text-tinta-suave text-base">Nada a la vista en los próximos días.</p>
        ) : (
          <ul aria-label="Lo que viene" className="flex flex-col gap-1">
            {r.viene.citas.map((c) => (
              <li key={`${c.fecha}-${c.titulo}`} className="text-base">
                📌 {c.titulo}{" "}
                <span className="text-tinta-suave text-sm">
                  · {fechaLegible(c.fecha)}
                  {c.hora ? ` · ${c.hora}` : ""}
                </span>
              </li>
            ))}
            {r.viene.cumples.map((c) => (
              <li key={c.nombre} className="text-base">
                🎂 Cumple de {c.nombre}{" "}
                <span className="text-tinta-suave text-sm">
                  · {c.dias === 1 ? "mañana" : `en ${c.dias} días`}
                </span>
              </li>
            ))}
            {r.viene.papeles.map((p) => (
              <li key={p.titulo} className="text-base">
                📄 {p.titulo}{" "}
                <span className="text-tinta-suave text-sm">
                  ·{" "}
                  {p.dias < 0
                    ? `venció hace ${-p.dias} días`
                    : p.dias === 0
                      ? "vence hoy"
                      : `vence en ${p.dias} días`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/semana" className="boton w-fit">
          <span aria-hidden="true">🗓️ </span>Planear la semana
        </Link>
      </section>
    </div>
  );
}
