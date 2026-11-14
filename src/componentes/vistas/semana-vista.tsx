"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { planDeLaSemana, textoDelPlan } from "@/aplicacion/semana";
import { enlaceWhatsApp } from "@/dominio/compartir";
import { BotonEditar, EditarCita, EditarComida, EditarCumple, EditarTareaCasa } from "../editar";
import { useHogar } from "../proveedor-hogar";

/** Una línea del día con su botón de editar (D-153). */
function Fila({
  nombre,
  alEditar,
  children,
}: {
  nombre: string;
  alEditar: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-base">{children}</p>
      <BotonEditar nombre={nombre} alPulsar={alEditar} />
    </div>
  );
}

/**
 * Planear la semana (D-137): de un vistazo, día a día, y con los botones para dejarla lista:
 * proponer las cenas que faltan, revisar la compra y mandar el plan por WhatsApp. Cada cosa se
 * edita ahí mismo y cada día se abre en el calendario, con todo lo de ese día (D-153).
 */
export function SemanaVista() {
  const { estado, despachar } = useHogar();
  const plan = planDeLaSemana(estado);
  const [editando, setEditando] = useState<string | null>(null);
  const cerrar = () => setEditando(null);

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
          const enCalendario = `/calendario?dia=${d.fecha}`;
          return (
            <li key={d.fecha} className="tarjeta flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold capitalize">
                  {d.nombre}
                  {hoy && <span className="text-marca-fuerte text-sm font-bold"> · hoy</span>}
                </h2>
                <Link
                  href={enCalendario}
                  className="boton-suave"
                  aria-label={`Abrir el ${d.nombre}`}
                >
                  Abrir
                </Link>
              </div>
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
              {d.cumpleanos.map((c) => {
                const cumple = estado.cumples.find((x) => x.id === c.id);
                const clave = `cumple:${c.id}`;
                return editando === clave && cumple ? (
                  <EditarCumple key={clave} cumple={cumple} alCerrar={cerrar} />
                ) : (
                  <Fila
                    key={clave}
                    nombre={`cumple de ${c.nombre}`}
                    alEditar={() => setEditando(clave)}
                  >
                    <span aria-hidden="true">🎂 </span>
                    <strong>Cumple de {c.nombre}</strong>
                  </Fila>
                );
              })}
              {d.citas.map((c) => {
                const cita = estado.agenda.find((x) => x.id === c.id);
                const clave = `cita:${d.fecha}:${c.id}`;
                return editando === clave && cita ? (
                  <EditarCita key={clave} cita={cita} alCerrar={cerrar} />
                ) : (
                  <Fila key={clave} nombre={c.titulo} alEditar={() => setEditando(clave)}>
                    <span aria-hidden="true">📌 </span>
                    {c.hora && <strong>{c.hora} </strong>}
                    {c.titulo}
                  </Fila>
                );
              })}
              {d.comidas.map((c) => {
                const comida = estado.almuerzos.find((x) => x.id === c.id);
                const clave = `comida:${c.id}`;
                return editando === clave && comida ? (
                  <EditarComida key={clave} comida={comida} alCerrar={cerrar} />
                ) : (
                  <Fila
                    key={clave}
                    nombre={`comida ${c.texto}`}
                    alEditar={() => setEditando(clave)}
                  >
                    <span aria-hidden="true">☀️ </span>Comida: {c.texto}
                  </Fila>
                );
              })}
              {(d.cena.length > 0 || !d.sinCena) && (
                <div className="flex items-center justify-between gap-2">
                  {d.cena.length > 0 ? (
                    <p className="text-base">
                      <span aria-hidden="true">🍽️ </span>Cena: {d.cena.join(" + ")}
                    </p>
                  ) : (
                    <p className="text-aviso-texto text-base">
                      <span aria-hidden="true">🍽️ </span>Cena por decidir
                    </p>
                  )}
                  <Link
                    href={enCalendario}
                    className="boton-icono"
                    aria-label={`${d.cena.length > 0 ? "Cambiar" : "Elegir"} la cena del ${d.nombre}`}
                    title={d.cena.length > 0 ? "Cambiar la cena" : "Elegir la cena"}
                  >
                    <span aria-hidden="true">✏️</span>
                  </Link>
                </div>
              )}
              {d.preparar.map((p) => (
                <button
                  key={`${p.id}:${p.para}`}
                  type="button"
                  aria-pressed={p.hecho}
                  className={`flex min-h-11 items-center gap-2 rounded-xl text-left text-base ${p.hecho ? "text-tinta-suave line-through" : ""}`}
                  onClick={() => despachar({ tipo: "mochila/preparar", id: p.id, para: p.para })}
                >
                  <span aria-hidden="true">{p.hecho ? "✅" : "🎒"}</span>
                  <span>
                    Preparar: {p.texto}
                    {p.persona && ` de ${p.persona}`}
                  </span>
                </button>
              ))}
              {d.llevar.length > 0 && (
                <p className="text-tinta-suave text-sm">
                  Llevan: {d.llevar.map((c) => `${c.texto} (${c.persona})`).join(", ")}
                </p>
              )}
              {d.casa.map((c) => {
                const tarea = estado.casa.find((x) => x.id === c.id);
                const clave = `casa:${d.fecha}:${c.id}`;
                return editando === clave && tarea ? (
                  <EditarTareaCasa key={clave} tarea={tarea} alCerrar={cerrar} />
                ) : (
                  <Fila key={clave} nombre={c.titulo} alEditar={() => setEditando(clave)}>
                    <span aria-hidden="true">{c.emoji} </span>
                    {c.titulo}
                  </Fila>
                );
              })}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
