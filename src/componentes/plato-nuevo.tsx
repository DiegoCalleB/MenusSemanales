"use client";

import { useId, useState } from "react";
import { idDePlatoRapido } from "@/aplicacion/estado";
import { GRUPOS_PLATO, type GrupoPlato } from "@/dominio/menu";
import { NOMBRE_GRUPO_ES } from "@/dominio/texto";
import { EMOJI_GRUPO } from "./formato";
import { useHogar } from "./proveedor-hogar";

export const clavePlato = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** ¿Ya hay un plato con ese nombre en los platos del hogar? */
export function existePlato(nombres: readonly string[], texto: string): boolean {
  const k = clavePlato(texto);
  return k !== "" && nombres.some((n) => clavePlato(n) === k);
}

/** Crea un plato nuevo en los platos del hogar y devuelve su id, para usarlo en seguida. */
export function useCrearPlato(): (nombre: string, grupo: GrupoPlato) => string {
  const { despachar } = useHogar();
  return (nombre, grupo) => {
    const idBase = crypto.randomUUID();
    despachar({ tipo: "plato/rapido", nombre, grupo, idBase });
    return idDePlatoRapido(idBase);
  };
}

/**
 * «Ese plato no está en vuestros platos»: deja elegir si se añade a los platos del hogar (para
 * poder repetirlo y que entre en la compra) o solo se usa esta vez.
 */
export function OfrecerPlatoNuevo({
  nombre,
  textoAnadir,
  textoSoloEstaVez,
  onAnadir,
  onSoloEstaVez,
  onCancelar,
}: {
  nombre: string;
  textoAnadir: string;
  textoSoloEstaVez?: string;
  onAnadir: (grupo: GrupoPlato) => void;
  onSoloEstaVez?: () => void;
  onCancelar?: () => void;
}) {
  const id = useId();
  const [grupo, setGrupo] = useState<GrupoPlato>("otro");
  return (
    <div
      role="group"
      aria-label={`${nombre} no está en vuestros platos`}
      className="tarjeta flex flex-col gap-2"
    >
      <p className="text-base font-bold">«{nombre}» no está en vuestros platos. ¿Lo añadimos?</p>
      <label htmlFor={`${id}-g`} className="flex flex-col gap-1 text-base font-semibold">
        ¿Qué tipo de plato es?
        <select
          id={`${id}-g`}
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
      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton" onClick={() => onAnadir(grupo)}>
          {textoAnadir}
        </button>
        {onSoloEstaVez && (
          <button type="button" className="boton-suave" onClick={onSoloEstaVez}>
            {textoSoloEstaVez ?? "No añadir"}
          </button>
        )}
        {onCancelar && (
          <button type="button" className="boton-suave" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
      <p className="text-tinta-suave text-sm">
        Se guarda con el nombre y el tipo; los ingredientes se completan después en «Platos».
      </p>
    </div>
  );
}
