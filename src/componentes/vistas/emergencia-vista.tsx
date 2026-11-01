"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cenaDeEmergenciaHoy } from "@/aplicacion/estado";
import { EMOJI_GRUPO, formatearCantidad } from "../formato";
import { IconoReloj } from "../iconos";
import { useHogar } from "../proveedor-hogar";

/** «Hoy llego tarde»: lo que se puede cenar YA, en 15 minutos o menos, con lo que hay en casa. */
export function EmergenciaVista() {
  const { estado, despachar } = useHogar();
  const opciones = useMemo(() => cenaDeEmergenciaHoy(estado), [estado]);
  const ingredientes = useMemo(
    () => new Map(estado.ingredientes.map((i) => [i.id, i])),
    [estado.ingredientes],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/menu" className="boton-suave w-fit">
          ← Volver al menú
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Cena de emergencia <span aria-hidden="true">⏱️</span>
        </h1>
      </header>

      {opciones.length === 0 ? (
        <p className="tarjeta text-base">
          Con lo que hay ahora mismo no sale ninguna cena rápida. Apunta lo que falte en la lista de
          la compra o prueba con el menú de la semana.
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {opciones.map((o) => (
            <li key={o.plato.id} className="tarjeta flex flex-col gap-3">
              <div>
                <h2 className="text-xl font-extrabold">
                  <span aria-hidden="true">{EMOJI_GRUPO[o.plato.grupo]} </span>
                  {o.plato.nombre}
                </h2>
                <p className="text-tinta-suave flex items-center gap-1.5 text-base">
                  <IconoReloj width={18} height={18} />
                  {o.plato.minutosActivos} min
                </p>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {o.completa ? (
                  <li className="etiqueta bg-ok-fondo text-ok-texto">✓ Tenéis todo</li>
                ) : (
                  <li className="etiqueta bg-aviso-fondo text-aviso-texto">
                    Falta:{" "}
                    {o.faltan
                      .map((f) => {
                        const ing = ingredientes.get(f.ingredienteId);
                        return ing
                          ? `${ing.nombre} (${formatearCantidad(f.falta, ing.unidad)})`
                          : f.ingredienteId;
                      })
                      .join(", ")}
                  </li>
                )}
                {o.usaCaducidad && (
                  <li className="etiqueta bg-suave-1 text-tinta">Gasta lo que caduca</li>
                )}
                {o.encajaConCole && estado.colegio[estado.hoy] && (
                  <li className="etiqueta bg-suave-3 text-tinta">Encaja con el cole</li>
                )}
              </ul>
              {o.completa ? (
                <button
                  type="button"
                  className="boton"
                  onClick={() => despachar({ tipo: "emergencia/cocinar", platoId: o.plato.id })}
                >
                  Cocinar ahora
                </button>
              ) : (
                <button
                  type="button"
                  className="boton-suave"
                  onClick={() =>
                    despachar({ tipo: "menu/elegir", fecha: estado.hoy, platoId: o.plato.id })
                  }
                >
                  Elegir para hoy y apuntar lo que falta
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
