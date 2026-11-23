"use client";

import { useState } from "react";
import { TARJETAS, ajusteDe, mover, ocultasDe, ordenDe } from "@/dominio/hoy";
import { useHogar } from "./proveedor-hogar";
import { useMomento } from "./usar-momento";
import { modoDe, TARJETAS_PERSONALES } from "@/dominio/modo";
import { useYo } from "./yo";

/**
 * Hoy a tu manera (D-196): elegir qué tarjetas se ven y en qué orden. Cada cambio se guarda al
 * momento, solo para quien lo hace. Se puede volver a lo de siempre.
 */
export function PersonalizarHoy() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const [abierto, setAbierto] = useState(false);
  const momento = useMomento();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  if (!yo) return null;

  const ajuste = ajusteDe(estado.ajustesHoy, yo.id);
  const orden = ordenDe(ajuste, momento);
  const ocultas = ocultasDe(ajuste);
  const modo = modoDe(estado.modos, estado.personas, yo.id);
  const personales = new Set<string>(TARJETAS_PERSONALES);
  const guardar = (nuevoOrden: string[], nuevasOcultas: Set<string>) =>
    despachar({
      tipo: "hoy/ajustar",
      personaId: yo.id,
      orden: nuevoOrden,
      ocultas: [...nuevasOcultas],
    });

  if (!abierto) {
    return (
      <button type="button" className="boton-suave w-fit" onClick={() => setAbierto(true)}>
        <span aria-hidden="true">⚙️</span> Personalizar Hoy
      </button>
    );
  }

  return (
    <section aria-labelledby="personalizar-hoy" className="tarjeta flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="personalizar-hoy" className="text-lg font-extrabold">
          <span aria-hidden="true">⚙️ </span>Personalizar Hoy
        </h2>
        <button type="button" className="boton" onClick={() => setAbierto(false)}>
          Listo
        </button>
      </div>
      <p className="text-tinta-suave text-sm">
        Elige qué tarjetas ves y en qué orden. Es solo para ti. En pantallas anchas, cada tarjeta
        sigue en su columna y el orden vale dentro de ella.{" "}
        {ajuste
          ? "«Volver a como estaba» devuelve el orden automático según la hora del día."
          : "Mientras no lo cambies, Hoy pone primero lo que toca según la hora: por la mañana el cole, por la tarde las citas y la compra, por la noche lo de mañana."}
      </p>
      <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={modo === "completo"}
          onChange={(e) =>
            despachar({
              tipo: "persona/modo",
              personaId: yo.id,
              modo: e.target.checked ? "completo" : "familia",
            })
          }
        />
        Mi espacio personal (Mi día, objetivos, notas)
      </label>
      <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={estado.laboratorio}
          onChange={(e) => despachar({ tipo: "hogar/laboratorio", encendido: e.target.checked })}
        />
        Laboratorio (barrio, premios, reparto, Metropolitano): para toda la casa
      </label>
      <ul aria-label="Tarjetas de Hoy" className="flex flex-col">
        {orden.map((id, i) => {
          const t = TARJETAS.find((x) => x.id === id);
          if (!t || (modo === "familia" && personales.has(id))) return null;
          const oculta = ocultas.has(id);
          return (
            <li key={id} className="border-borde flex items-center gap-1 border-b last:border-b-0">
              <span className={`flex-1 text-base ${oculta ? "text-tinta-suave line-through" : ""}`}>
                <span aria-hidden="true">{t.emoji} </span>
                {t.nombre}
              </span>
              {!t.fija && (
                <button
                  type="button"
                  aria-pressed={!oculta}
                  className="boton-suave"
                  onClick={() => {
                    const nuevas = new Set(ocultas);
                    if (oculta) nuevas.delete(id);
                    else nuevas.add(id);
                    guardar(orden, nuevas);
                  }}
                >
                  <span className="sr-only">{t.nombre}: </span>
                  {oculta ? "Mostrar" : "Ocultar"}
                </button>
              )}
              <button
                type="button"
                className="boton-icono"
                aria-label={`Subir ${t.nombre}`}
                disabled={i === 0}
                onClick={() => guardar(mover(orden, id, -1), ocultas)}
              >
                <span aria-hidden="true">▲</span>
              </button>
              <button
                type="button"
                className="boton-icono"
                aria-label={`Bajar ${t.nombre}`}
                disabled={i === orden.length - 1}
                onClick={() => guardar(mover(orden, id, 1), ocultas)}
              >
                <span aria-hidden="true">▼</span>
              </button>
            </li>
          );
        })}
      </ul>
      {ajuste && (
        <button
          type="button"
          className="boton-suave w-fit"
          onClick={() => despachar({ tipo: "hoy/restablecer", personaId: yo.id })}
        >
          Volver a como estaba
        </button>
      )}
    </section>
  );
}
