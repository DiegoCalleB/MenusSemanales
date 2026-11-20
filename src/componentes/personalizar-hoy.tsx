"use client";

import { useState } from "react";
import { TARJETAS, ajusteDe, mover, ocultasDe, ordenDe } from "@/dominio/hoy";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

/**
 * Hoy a tu manera (D-196): elegir qué tarjetas se ven y en qué orden. Cada cambio se guarda al
 * momento, solo para quien lo hace. Se puede volver a lo de siempre.
 */
export function PersonalizarHoy() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const [abierto, setAbierto] = useState(false);
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  if (!yo) return null;

  const ajuste = ajusteDe(estado.ajustesHoy, yo.id);
  const orden = ordenDe(ajuste);
  const ocultas = ocultasDe(ajuste);
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
        sigue en su columna y el orden vale dentro de ella.
      </p>
      <ul aria-label="Tarjetas de Hoy" className="flex flex-col">
        {orden.map((id, i) => {
          const t = TARJETAS.find((x) => x.id === id);
          if (!t) return null;
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
