"use client";

import {
  cuantoQueda,
  haceCuanto,
  plazoLargo,
  porPlazo,
  quePideHacer,
  textoCada,
} from "@/dominio/objetivos";
import { useHogar } from "./proveedor-hogar";
import { SeccionHoy, Vacio } from "./seccion-hoy";
import { useYo } from "./yo";

const MAX_A_LA_VISTA = 3;

/**
 * Objetivos en «Hoy» (D-195, D-198): lo que se repite y ya toca («Plan a solas con Lucía») y el
 * plazo más próximo con algo por conseguir, con su siguiente paso. Se marca ahí mismo. Es personal:
 * solo se ve en el móvil de quien es y no sale de la app.
 */
export function ObjetivosHoy() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  if (!yo) return null;

  const grupos = porPlazo(estado.objetivos, yo.id);
  const tocan = quePideHacer(estado.objetivos, yo.id, estado.hoy).slice(0, 2);
  const actual = grupos.find((g) => g.objetivos.some((o) => o.hechoEn === null && o.cada === null));
  const pendientes = actual?.objetivos.filter((o) => o.hechoEn === null && o.cada === null) ?? [];
  const vacio = !actual && tocan.length === 0;
  const enlace = { href: "/objetivos", texto: grupos.length === 0 ? "Apuntar" : "Ver todos" };

  return (
    <SeccionHoy id="sec-objetivos" emoji="🎯" titulo="Objetivos" compacta={vacio} enlace={enlace}>
      {vacio ? (
        <Vacio>
          {grupos.length === 0
            ? "Apunta lo que quieres conseguir, por plazos."
            : "¡Todo al día! 🎉"}
        </Vacio>
      ) : (
        <>
          {tocan.length > 0 && (
            <ul aria-label="Toca hacer" className="flex flex-col">
              {tocan.map(({ objetivo: o, dias }) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-base">
                    <span aria-hidden="true">🔁 </span>
                    {o.texto}
                    <span className="text-aviso-texto block text-sm font-semibold">
                      {textoCada(o.cada ?? 0)} · {o.movidoEn ? haceCuanto(dias) : "toca ya"}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="boton"
                    aria-label={`Hecho hoy: ${o.texto}`}
                    onClick={() => despachar({ tipo: "objetivo/movido", id: o.id })}
                  >
                    ✓ Hecho
                  </button>
                </li>
              ))}
            </ul>
          )}
          {actual && (
            <>
              <p className="text-tinta-suave text-sm">
                Hasta el {plazoLargo(actual.hasta)} · {cuantoQueda(actual.hasta, estado.hoy)}
              </p>
              <ul aria-label="Objetivos del plazo más próximo" className="flex flex-col">
                {pendientes.slice(0, MAX_A_LA_VISTA).map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      aria-pressed={false}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-base"
                      onClick={() => despachar({ tipo: "objetivo/hecho", id: o.id, hecho: true })}
                    >
                      <span aria-hidden="true">⬜</span>
                      <span>
                        {o.texto}
                        {o.siguiente && (
                          <span className="text-tinta-suave block text-sm">
                            <span aria-hidden="true">→ </span>
                            {o.siguiente}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {pendientes.length > MAX_A_LA_VISTA && (
                <p className="text-tinta-suave text-sm">
                  y {pendientes.length - MAX_A_LA_VISTA} más
                </p>
              )}
            </>
          )}
        </>
      )}
    </SeccionHoy>
  );
}
