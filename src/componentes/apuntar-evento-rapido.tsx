"use client";

import { useState } from "react";
import { parsearAgenda } from "@/dominio/agenda";
import { LeerCircular } from "./leer-circular";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

const fechaCorta = (f: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${f}T12:00:00Z`));

/**
 * Apuntar un evento desde el botón ＋ (D-160), en cualquier pantalla: escribiéndolo como en una nota
 * («21 Noviembre 17:00 Cumple de Leo») o leyendo con IA la foto de un cartel o una circular.
 */
export function ApuntarEventoRapido({ alTerminar }: { alTerminar: () => void }) {
  const { estado, despachar } = useHogar();
  const [yo] = useYo();
  const [texto, setTexto] = useState("");
  const leido = parsearAgenda(texto, estado.hoy);
  const primero = leido.conFecha[0];

  function apuntar() {
    if (leido.conFecha.length === 0) return;
    despachar({ tipo: "agenda/anadir", texto, personaId: yo });
    setTexto("");
    alTerminar();
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apuntar();
        }}
      >
        <label htmlFor="evento-rapido" className="text-tinta-suave text-sm">
          Qué y cuándo, como en una nota: «21 Noviembre 17:00 Cumple de Leo»
        </label>
        <input
          id="evento-rapido"
          className="campo"
          value={texto}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => setTexto(e.target.value)}
        />
        {texto.trim() !== "" && (
          <p role="status" className="text-sm">
            {primero
              ? `📌 ${fechaCorta(primero.fecha)}${primero.hora ? ` · ${primero.hora}` : ""} · ${primero.titulo}`
              : "Pon el día: «21 Noviembre Cumple de Leo» o «21/11 Dentista»."}
          </p>
        )}
        <button type="submit" className="boton w-fit" disabled={!primero}>
          Apuntar
        </button>
      </form>
      <LeerCircular etiqueta="📷 Leer un cartel o una foto" alTerminar={alTerminar} />
    </div>
  );
}
