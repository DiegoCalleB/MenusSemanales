"use client";

import { type FormEvent, useId, useState } from "react";
import { GRUPOS_PLATO, type GrupoPlato } from "@/dominio/menu";
import { NOMBRE_GRUPO_ES } from "@/dominio/texto";
import { EMOJI_GRUPO } from "./formato";
import { clavePlato, useCrearPlato } from "./plato-nuevo";
import { useHogar } from "./proveedor-hogar";

const MAX_SUGERENCIAS = 5;

/**
 * Campo siempre a la vista para poner un plato en la cena: se escribe el nombre y salen los platos
 * del hogar que encajan para elegirlos con un toque; si no existe, se crea ahí mismo (con su tipo)
 * y se elige. Sin abrir listas ni pulsar «buscar».
 */
export function PlatoRapido({
  anadir,
  alElegir,
}: {
  anadir: boolean;
  alElegir: (platoId: string) => void;
}) {
  const { estado } = useHogar();
  const crearPlato = useCrearPlato();
  const id = useId();
  const [texto, setTexto] = useState("");
  const [grupo, setGrupo] = useState<GrupoPlato>("otro");
  const nombre = texto.replace(/\s+/g, " ").trim();
  const k = clavePlato(nombre);
  const coinciden =
    k === ""
      ? []
      : estado.platos.filter((p) => clavePlato(p.nombre).includes(k)).slice(0, MAX_SUGERENCIAS);
  const exacto = estado.platos.find((p) => clavePlato(p.nombre) === k);

  function elegir(platoId: string) {
    alElegir(platoId);
    setTexto("");
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (nombre.length < 2) return;
    if (exacto) elegir(exacto.id);
    else elegir(crearPlato(nombre, grupo));
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2" aria-label="Poner otro plato">
      <label htmlFor={id} className="text-base font-bold">
        {anadir ? "Añadir un plato" : "¿Otro plato?"}
      </label>
      <input
        id={id}
        className="campo"
        value={texto}
        maxLength={120}
        autoComplete="off"
        placeholder="Escribe el nombre: pollo a la plancha…"
        onChange={(e) => setTexto(e.target.value)}
      />
      {coinciden.length > 0 && (
        <ul aria-label="Platos que coinciden" className="flex flex-col gap-2">
          {coinciden.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="boton-suave w-full justify-between text-left"
                aria-label={`${anadir ? "Añadir" : "Elegir"} ${p.nombre}`}
                onClick={() => elegir(p.id)}
              >
                <span>
                  <span aria-hidden="true">{EMOJI_GRUPO[p.grupo] ?? "🍽️"} </span>
                  {p.nombre}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {nombre.length >= 2 && !exacto && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Tipo de plato
            <select
              className="campo"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value as GrupoPlato)}
            >
              {GRUPOS_PLATO.map((g) => (
                <option key={g} value={g}>
                  {EMOJI_GRUPO[g] ?? "🍽️"} {NOMBRE_GRUPO_ES[g] ?? g}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="boton">
            Crear «{nombre}» y {anadir ? "añadirlo" : "elegirlo"}
          </button>
        </div>
      )}
      {exacto && (
        <button type="submit" className="boton w-fit">
          {anadir ? "Añadir" : "Elegir"} {exacto.nombre}
        </button>
      )}
    </form>
  );
}
