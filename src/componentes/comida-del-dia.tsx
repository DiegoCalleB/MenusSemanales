"use client";

import { type FormEvent, useId, useState } from "react";
import { almuerzosDe, POR_DECIDIR } from "@/dominio/almuerzos";
import type { FechaIso } from "@/dominio/fechas";
import { EMOJI_GRUPO } from "./formato";
import { OfrecerPlatoNuevo, existePlato, useCrearPlato } from "./plato-nuevo";
import { useHogar } from "./proveedor-hogar";

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * La comida del mediodía de un día (D-079): hay días —fines de semana, fiestas— en que no solo hay
 * que pensar la cena. Se apunta un plato del catálogo (entra en la compra) o un texto libre.
 */
export function ComidaDelDia({ fecha, puedeApuntar }: { fecha: FechaIso; puedeApuntar: boolean }) {
  const { estado, despachar } = useHogar();
  const crearPlato = useCrearPlato();
  const [ofrecer, setOfrecer] = useState<string | null>(null);
  const id = useId();
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");
  const lista = almuerzosDe(estado.almuerzos, fecha);
  const platos = estado.platos
    .filter((p) => !p.noProponer && (q === "" || sinTildes(p.nombre).includes(sinTildes(q))))
    .slice(0, 8);

  function apuntar(e: FormEvent) {
    e.preventDefault();
    const nombre = texto.trim();
    const coincide = estado.platos.find((p) => existePlato([p.nombre], nombre));
    if (coincide) {
      // Es un plato de la casa: se apunta como tal, para que entre en la compra.
      despachar({ tipo: "almuerzo/anadir", fecha, platoId: coincide.id });
      setTexto("");
    } else if (nombre.length >= 2) {
      setOfrecer(nombre);
    } else {
      despachar({ tipo: "almuerzo/anadir", fecha, texto });
      setTexto("");
    }
  }

  return (
    <section aria-label="Comida del mediodía" className="flex flex-col gap-2">
      <h3 className="text-base font-extrabold">
        <span aria-hidden="true">☀️ </span>Comida
      </h3>
      {lista.length === 0 && (
        <p className="text-tinta-suave text-base">
          {puedeApuntar ? "Sin comida pensada." : "Sin comida apuntada."}
        </p>
      )}
      {lista.map((a) => (
        <div
          key={a.id}
          className="bg-ok-fondo text-ok-texto flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
        >
          <p className="text-base font-bold">
            <span aria-hidden="true">✓ </span>
            {a.texto}
          </p>
          <button
            type="button"
            className="boton-suave"
            aria-label={`Quitar comida: ${a.texto}`}
            onClick={() => despachar({ tipo: "almuerzo/borrar", id: a.id })}
          >
            Quitar
          </button>
        </div>
      ))}
      {puedeApuntar && (
        <>
          <p className="text-tinta-suave text-sm">
            Un plato de tus platos cuenta para la compra y para decidir la cena (si hoy se ha comido
            carne, mejor cenar huevo o pescado). Un texto libre solo se apunta.
          </p>
          <form onSubmit={apuntar} className="flex flex-wrap items-end gap-2">
            <label htmlFor={`${id}-t`} className="sr-only">
              Qué se come
            </label>
            <input
              id={`${id}-t`}
              className="campo min-w-0 flex-1"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={80}
              placeholder="Qué se come: paella, en casa de los abuelos…"
            />
            <button type="submit" className="boton" disabled={texto.trim() === ""}>
              Apuntar
            </button>
          </form>
          {ofrecer && (
            <OfrecerPlatoNuevo
              nombre={ofrecer}
              textoAnadir="Añadir a mis platos y apuntarlo"
              textoSoloEstaVez="Solo apuntarlo esta vez"
              onAnadir={(grupo) => {
                despachar({
                  tipo: "almuerzo/anadir",
                  fecha,
                  platoId: crearPlato(ofrecer, grupo),
                });
                setOfrecer(null);
                setTexto("");
              }}
              onSoloEstaVez={() => {
                despachar({ tipo: "almuerzo/anadir", fecha, texto: ofrecer });
                setOfrecer(null);
                setTexto("");
              }}
              onCancelar={() => setOfrecer(null)}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="boton-suave"
              onClick={() => despachar({ tipo: "almuerzo/anadir", fecha, texto: POR_DECIDIR })}
            >
              ❓ Por decidir
            </button>
            <button
              type="button"
              className="boton-suave"
              aria-expanded={buscando}
              onClick={() => setBuscando((v) => !v)}
            >
              📚 Elegir un plato
            </button>
          </div>
          {buscando && (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-q`} className="sr-only">
                Buscar un plato para la comida
              </label>
              <input
                id={`${id}-q`}
                type="search"
                className="campo"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar un plato"
              />
              <ul aria-label="Platos para la comida" className="flex flex-col gap-2">
                {platos.map((p) => (
                  <li
                    key={p.id}
                    className="border-borde bg-fondo flex items-center justify-between gap-3 rounded-2xl border p-3"
                  >
                    <span className="min-w-0 text-base font-bold">
                      <span aria-hidden="true">{EMOJI_GRUPO[p.grupo] ?? "🍽️"} </span>
                      {p.nombre}
                    </span>
                    <button
                      type="button"
                      className="boton"
                      aria-label={`Comer ${p.nombre}`}
                      onClick={() => {
                        despachar({ tipo: "almuerzo/anadir", fecha, platoId: p.id });
                        setBuscando(false);
                        setQ("");
                      }}
                    >
                      Comer
                    </button>
                  </li>
                ))}
                {platos.length === 0 && (
                  <li className="text-tinta-suave text-base">Ningún plato con ese nombre.</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
