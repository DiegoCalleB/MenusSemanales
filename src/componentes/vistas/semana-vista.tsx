"use client";

import Link from "next/link";
import { planDeLaSemana, textoDelPlan } from "@/aplicacion/semana";
import { enlaceWhatsApp } from "@/dominio/compartir";
import { useHogar } from "../proveedor-hogar";

/**
 * Planear la semana (D-137): de un vistazo, día a día, y con los botones para dejarla lista:
 * proponer las cenas que faltan, revisar la compra y mandar el plan por WhatsApp.
 */
export function SemanaVista() {
  const { estado, despachar } = useHogar();
  const plan = planDeLaSemana(estado);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Plan de la semana <span aria-hidden="true">🗓️</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Míralo una vez y olvídate: lo que queda pendiente, con su botón.
        </p>
      </header>

      <section aria-label="Para dejar la semana lista" className="tarjeta flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base">
            <span aria-hidden="true">🍽️ </span>
            {plan.faltanCenas === 0 ? (
              <strong>Todas las cenas elegidas</strong>
            ) : (
              <>
                Faltan <strong>{plan.faltanCenas}</strong>{" "}
                {plan.faltanCenas === 1 ? "cena" : "cenas"}
              </>
            )}
          </p>
          {plan.faltanCenasLaborables > 0 ? (
            <button
              type="button"
              className="boton"
              onClick={() => despachar({ tipo: "menu/autocompletar" })}
            >
              ✨ Proponer cenas
            </button>
          ) : (
            <Link href="/menu" className="boton-suave">
              Ver el menú
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base">
            <span aria-hidden="true">🛒 </span>
            {plan.porComprar === 0 ? (
              "La lista de la compra está vacía"
            ) : (
              <>
                <strong>{plan.porComprar}</strong> {plan.porComprar === 1 ? "cosa" : "cosas"} en la
                lista
              </>
            )}
          </p>
          <Link href="/compra" className="boton-suave">
            Hacer la compra
          </Link>
        </div>
        <a
          className="boton-suave w-fit"
          href={enlaceWhatsApp(textoDelPlan(plan))}
          target="_blank"
          rel="noopener noreferrer"
        >
          📤 Mandar el plan por WhatsApp
        </a>
      </section>

      <ol aria-label="Días de la semana" className="flex flex-col gap-3">
        {plan.dias.map((d) => {
          const hoy = d.fecha === estado.hoy;
          return (
            <li key={d.fecha} className="tarjeta flex flex-col gap-1.5">
              <h2 className="text-lg font-extrabold capitalize">
                {d.nombre}
                {hoy && <span className="text-marca-fuerte text-sm font-bold"> · hoy</span>}
              </h2>
              {d.evento && (
                <p className="text-base">
                  <span aria-hidden="true">{d.evento.emoji} </span>
                  {d.evento.titulo}
                </p>
              )}
              {d.sinCole && (
                <p className="text-base font-semibold">
                  <span aria-hidden="true">🏫 </span>Sin cole: {d.sinCole}
                </p>
              )}
              {d.cumples.map((c) => (
                <p key={c} className="text-base font-semibold">
                  <span aria-hidden="true">🎂 </span>Cumple de {c}
                </p>
              ))}
              {d.citas.map((c, i) => (
                <p key={i} className="text-base">
                  <span aria-hidden="true">📌 </span>
                  {c.hora && <strong>{c.hora} </strong>}
                  {c.titulo}
                </p>
              ))}
              {d.comida.length > 0 && (
                <p className="text-base">
                  <span aria-hidden="true">☀️ </span>Comida: {d.comida.join(" + ")}
                </p>
              )}
              {d.cena.length > 0 ? (
                <p className="text-base">
                  <span aria-hidden="true">🍽️ </span>Cena: {d.cena.join(" + ")}
                </p>
              ) : (
                !d.sinCena && (
                  <p className="text-aviso-texto text-base">
                    <span aria-hidden="true">🍽️ </span>Cena por decidir
                  </p>
                )
              )}
              {d.preparar.map((p, i) => (
                <p
                  key={i}
                  className={`text-base ${p.hecho ? "text-tinta-suave line-through" : ""}`}
                >
                  <span aria-hidden="true">🎒 </span>Preparar: {p.texto}
                  {p.persona && ` de ${p.persona}`}
                </p>
              ))}
              {d.llevar.length > 0 && (
                <p className="text-tinta-suave text-sm">
                  Llevan: {d.llevar.map((c) => `${c.texto} (${c.persona})`).join(", ")}
                </p>
              )}
              {d.casa.map((c, i) => (
                <p key={i} className="text-base">
                  <span aria-hidden="true">{c.emoji} </span>
                  {c.titulo}
                </p>
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
