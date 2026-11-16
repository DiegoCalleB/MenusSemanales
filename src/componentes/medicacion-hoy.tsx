"use client";

import { horaTexto, tocaTomar } from "@/dominio/medicacion";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

/**
 * Lo que toca tomar hoy (D-166), en «Hoy», solo del perfil que tiene abierto el móvil (la medicación
 * es personal: no se enseña la de los demás). «Tomada» la marca y la app ya no te lo recuerda.
 */
export function MedicacionHoy() {
  const { estado, despachar } = useHogar();
  const [yo] = useYo();
  const deHoy = estado.medicacion
    .filter((m) => m.personaId === yo && tocaTomar(m, estado.hoy))
    .sort((a, b) => a.hora - b.hora);
  if (deHoy.length === 0) return null;

  return (
    <section aria-labelledby="medicacion-hoy" className="tarjeta flex flex-col gap-2">
      <h2 id="medicacion-hoy" className="text-lg font-bold">
        <span aria-hidden="true">💊 </span>Hoy te toca
      </h2>
      <ul aria-label="Medicación de hoy" className="flex flex-col gap-1">
        {deHoy.map((m) => {
          const tomada = m.tomadas.includes(estado.hoy);
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={tomada}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-base ${tomada ? "text-tinta-suave line-through" : ""}`}
                onClick={() =>
                  despachar({ tipo: "medicacion/tomada", id: m.id, fecha: estado.hoy })
                }
              >
                <span aria-hidden="true">{tomada ? "✅" : "⬜"}</span>
                <span>
                  {m.nombre} <span className="text-tinta-suave">· {horaTexto(m.hora)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
