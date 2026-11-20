"use client";

import { cuantoQueda, plazoLargo, porPlazo } from "@/dominio/objetivos";
import { useHogar } from "./proveedor-hogar";
import { SeccionHoy, Vacio } from "./seccion-hoy";
import { useYo } from "./yo";

const MAX_A_LA_VISTA = 3;

/**
 * Objetivos en «Hoy» (D-195): el plazo más próximo con algo por conseguir, con sus primeros objetivos
 * para marcarlos ahí mismo. Es personal: solo se ve en el móvil de quien es y no sale de la app.
 */
export function ObjetivosHoy() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  if (!yo) return null;

  const grupos = porPlazo(estado.objetivos, yo.id);
  const actual = grupos.find((g) => g.objetivos.some((o) => o.hechoEn === null));
  const pendientes = actual?.objetivos.filter((o) => o.hechoEn === null) ?? [];
  const enlace = { href: "/objetivos", texto: grupos.length === 0 ? "Apuntar" : "Ver todos" };

  return (
    <SeccionHoy id="sec-objetivos" emoji="🎯" titulo="Objetivos" compacta={!actual} enlace={enlace}>
      {!actual ? (
        <Vacio>
          {grupos.length === 0
            ? "Apunta lo que quieres conseguir, por plazos."
            : "¡Todo conseguido! 🎉"}
        </Vacio>
      ) : (
        <>
          <p className="text-tinta-suave text-sm">
            Hasta el {plazoLargo(actual.hasta)} · {cuantoQueda(actual.hasta, estado.hoy)} ·{" "}
            {actual.hechos} de {actual.objetivos.length}
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
                  <span>{o.texto}</span>
                </button>
              </li>
            ))}
          </ul>
          {pendientes.length > MAX_A_LA_VISTA && (
            <p className="text-tinta-suave text-sm">y {pendientes.length - MAX_A_LA_VISTA} más</p>
          )}
        </>
      )}
    </SeccionHoy>
  );
}
