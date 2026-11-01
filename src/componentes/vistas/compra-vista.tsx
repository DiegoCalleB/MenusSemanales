"use client";

import { type FormEvent, useState } from "react";
import { articulosPendientes } from "@/aplicacion/estado";
import type { ArticuloCompra } from "@/dominio/compra";
import { formatearCantidad, NOMBRE_SECCION } from "../formato";
import { IconoMas } from "../iconos";
import { useHogar } from "../proveedor-hogar";

function agruparPorSeccion(articulos: readonly ArticuloCompra[]) {
  const grupos: Array<{ seccion: string; articulos: ArticuloCompra[] }> = [];
  for (const a of articulos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.seccion === a.seccion) ultimo.articulos.push(a);
    else grupos.push({ seccion: a.seccion, articulos: [a] });
  }
  return grupos;
}

interface FilaProps {
  nombre: string;
  detalle?: string;
  cantidad?: string;
  marcado: boolean;
  alCambiar: () => void;
  etiquetaAccion?: string;
}

/** Toda la fila es la casilla: se puede tocar en cualquier punto (mínimo 56 px de alto). */
function Fila({ nombre, detalle, cantidad, marcado, alCambiar }: FilaProps) {
  return (
    <li>
      <label className="hover:bg-fondo flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2 py-2">
        <input
          type="checkbox"
          checked={marcado}
          onChange={alCambiar}
          className="size-6 shrink-0 accent-[var(--marca)]"
        />
        <span className="min-w-0 flex-1">
          <span className={`block text-base ${marcado ? "text-tinta-suave line-through" : ""}`}>
            {nombre}
          </span>
          {detalle && <span className="text-tinta-suave block text-sm">{detalle}</span>}
        </span>
        {cantidad && (
          <span className="shrink-0 text-base font-medium tabular-nums">{cantidad}</span>
        )}
      </label>
    </li>
  );
}

export function CompraVista() {
  const { estado, despachar } = useHogar();
  const [nuevo, setNuevo] = useState("");
  const [ocultarComprado, setOcultarComprado] = useState(false);

  const pendientes = articulosPendientes(estado);
  const grupos = agruparPorSeccion(pendientes);
  const manualesPendientes = estado.manuales.filter((m) => !m.comprado);
  const manualesComprados = estado.manuales.filter((m) => m.comprado);

  const total = pendientes.length + estado.compras.length + estado.manuales.length;
  const hechos = estado.compras.length + manualesComprados.length;
  const hayComprado = hechos > 0;

  function anadir(evento: FormEvent) {
    evento.preventDefault();
    despachar({ tipo: "manual/anadir", nombre: nuevo });
    setNuevo("");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Lista de la compra</h1>
        <p className="text-tinta-suave max-w-prose text-base">
          Se calcula sola con las cenas elegidas, lo que ya hay en casa y lo que se está acabando.
        </p>
        <div className="flex items-center gap-3">
          <progress
            max={Math.max(total, 1)}
            value={hechos}
            aria-label="Progreso de la compra"
            className="h-3 w-full max-w-xs flex-1 overflow-hidden rounded-full accent-[var(--marca)]"
          />
          <span className="shrink-0 text-base font-medium tabular-nums">
            {hechos} de {total}
          </span>
        </div>
      </header>

      <form
        onSubmit={anadir}
        className="flex flex-col gap-2 sm:flex-row"
        aria-label="Añadir un artículo"
      >
        <label htmlFor="nuevo-articulo" className="sr-only">
          Añadir algo a la lista
        </label>
        <input
          id="nuevo-articulo"
          className="campo sm:flex-1"
          placeholder="Añadir algo a la lista (papel de cocina…)"
          value={nuevo}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => setNuevo(e.target.value)}
        />
        <button type="submit" className="boton sm:w-auto" disabled={nuevo.trim() === ""}>
          <IconoMas width={20} height={20} />
          Añadir
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {grupos.length === 0 && manualesPendientes.length === 0 ? (
          <p className="tarjeta text-tinta-suave text-base lg:col-span-2">
            No falta nada por comprar. Cuando elijáis la próxima cena, lo que haga falta aparecerá
            aquí.
          </p>
        ) : (
          <>
            {grupos.map(({ seccion, articulos }) => (
              <section key={seccion} aria-labelledby={`s-${seccion}`} className="tarjeta">
                <h2 id={`s-${seccion}`} className="mb-1 text-lg font-semibold">
                  {NOMBRE_SECCION[seccion] ?? seccion}
                </h2>
                <ul>
                  {articulos.map((a) => (
                    <Fila
                      key={a.ingredienteId}
                      nombre={a.nombre}
                      detalle={a.motivos.join(" · ")}
                      cantidad={formatearCantidad(a.cantidad, a.unidad)}
                      marcado={false}
                      alCambiar={() =>
                        despachar({ tipo: "comprar", ingredienteId: a.ingredienteId })
                      }
                    />
                  ))}
                </ul>
              </section>
            ))}
            {manualesPendientes.length > 0 && (
              <section aria-labelledby="s-manual" className="tarjeta">
                <h2 id="s-manual" className="mb-1 text-lg font-semibold">
                  Añadido a mano
                </h2>
                <ul>
                  {manualesPendientes.map((m) => (
                    <Fila
                      key={m.id}
                      nombre={m.nombre}
                      marcado={false}
                      alCambiar={() => despachar({ tipo: "manual/alternar", id: m.id })}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {hayComprado && (
        <section aria-labelledby="s-comprado" className="tarjeta">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="s-comprado" className="text-lg font-semibold">
              Comprado ({hechos})
            </h2>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base">
              <input
                type="checkbox"
                className="size-5 accent-[var(--marca)]"
                checked={ocultarComprado}
                onChange={(e) => setOcultarComprado(e.target.checked)}
              />
              Ocultar
            </label>
          </div>
          {!ocultarComprado && (
            <ul>
              {estado.compras.map((c) => (
                <Fila
                  key={c.id}
                  nombre={c.nombre}
                  detalle="Ya está en la despensa. Desmarca para deshacer."
                  cantidad={formatearCantidad(c.cantidad, c.unidad)}
                  marcado
                  alCambiar={() => despachar({ tipo: "deshacer", operacionId: c.operacionId })}
                />
              ))}
              {manualesComprados.map((m) => (
                <Fila
                  key={m.id}
                  nombre={m.nombre}
                  marcado
                  alCambiar={() => despachar({ tipo: "manual/alternar", id: m.id })}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
