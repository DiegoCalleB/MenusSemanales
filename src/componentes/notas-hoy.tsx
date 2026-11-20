"use client";

import { type FormEvent, useState } from "react";
import { bandeja, unDiaComoHoy } from "@/dominio/notas";
import { useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";
import { SeccionHoy } from "./seccion-hoy";
import { useYo } from "./yo";

/**
 * Notas e ideas en «Hoy» (D-199): apuntar una idea o un recuerdo en un segundo, cuántas ideas hay en
 * la bandeja y «Un día como hoy» (recuerdos de hace 1, 3, 6 meses o un año). Personal: solo en el
 * móvil de quien es y no sale de la app.
 */
export function NotasHoy() {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const guardar = useGuardar();
  const [texto, setTexto] = useState("");
  const [problema, setProblema] = useState("");
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  if (!yo) return null;

  const enBandeja = bandeja(estado.notas, yo.id).length;
  const recuerdos = unDiaComoHoy(estado.notas, yo.id, estado.hoy);

  function apuntar(e: FormEvent, nota: "idea" | "recuerdo") {
    e.preventDefault();
    const motivo = guardar({ tipo: "nota/anadir", personaId: yo!.id, nota, texto, sobre: null });
    setProblema(motivo ?? "");
    if (!motivo) setTexto("");
  }

  return (
    <SeccionHoy
      id="sec-notas"
      emoji="💡"
      titulo="Notas e ideas"
      cuenta={enBandeja}
      enlace={{ href: "/notas", texto: enBandeja > 0 ? "Revisar" : "Ver notas" }}
    >
      {recuerdos.length > 0 && (
        <ul aria-label="Un día como hoy" className="flex flex-col gap-1">
          {recuerdos.slice(0, 2).map(({ nota, hace }) => (
            <li key={nota.id} className="bg-suave-1 rounded-2xl p-2 text-base">
              <span className="text-tinta-suave block text-sm font-semibold">
                <span aria-hidden="true">💛 </span>Un día como hoy, {hace}
              </span>
              {nota.texto}
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => apuntar(e, "idea")}
        noValidate
        aria-label="Apuntar rápido"
        className="flex flex-col gap-2"
      >
        <input
          className="campo"
          aria-label="Apuntar una idea o un recuerdo"
          value={texto}
          maxLength={500}
          placeholder="Una idea, un recuerdo de hoy…"
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="boton">
            💡 Idea
          </button>
          <button type="button" className="boton-suave" onClick={(e) => apuntar(e, "recuerdo")}>
            💛 Recuerdo
          </button>
        </div>
        {problema && (
          <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
            {problema}
          </p>
        )}
      </form>
    </SeccionHoy>
  );
}
