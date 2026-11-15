"use client";

import { useRef, useState } from "react";
import { articulosPropuestos } from "@/aplicacion/estado";
import { formatearCantidad } from "./formato";
import { useHogar } from "./proveedor-hogar";

/**
 * Lo que pide el menú para la compra (D-157): no entra solo en la lista, porque la app no sabe bien
 * lo que hay en casa. Se avisa arriba y, en una ventana, se elige qué se añade y qué no hace falta
 * (lo descartado queda en «No hace falta», por si acaso).
 */
export function PropuestasCompra() {
  const { estado, despachar } = useHogar();
  const ventana = useRef<HTMLDialogElement>(null);
  const [desmarcados, setDesmarcados] = useState<ReadonlySet<string>>(new Set());
  const propuestos = articulosPropuestos(estado);
  if (propuestos.length === 0) return null;

  const marcados = propuestos.filter((a) => !desmarcados.has(a.ingredienteId));
  const abrir = () => {
    setDesmarcados(new Set());
    ventana.current?.showModal();
  };
  const cerrar = () => ventana.current?.close();
  const alternar = (id: string) =>
    setDesmarcados((d) => {
      const n = new Set(d);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const guardar = () => {
    despachar({
      tipo: "compra/revisar",
      anadir: marcados.map((a) => a.ingredienteId),
      descartar: propuestos
        .filter((a) => desmarcados.has(a.ingredienteId))
        .map((a) => a.ingredienteId),
    });
    cerrar();
  };

  return (
    <section
      aria-labelledby="propuestas-compra"
      className="tarjeta border-marca flex flex-col gap-2 border-2"
    >
      <h2 id="propuestas-compra" className="text-lg font-extrabold">
        <span aria-hidden="true">✨ </span>El menú pide {propuestos.length}{" "}
        {propuestos.length === 1 ? "cosa" : "cosas"}
      </h2>
      <p className="text-base">
        No sé lo que tenéis en casa: elige qué añadir a la lista y qué no hace falta.
      </p>
      <button type="button" className="boton w-fit" onClick={abrir}>
        Revisar
      </button>

      <dialog
        ref={ventana}
        aria-labelledby="titulo-propuestas"
        className="bg-superficie text-tinta m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl p-0 backdrop:bg-black/50"
      >
        <form
          method="dialog"
          className="flex max-h-[85vh] flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <h2 id="titulo-propuestas" className="text-xl font-extrabold">
            Lo que pide el menú
          </h2>
          <p className="text-tinta-suave text-sm">
            Desmarca lo que ya tengáis en casa. Lo desmarcado queda en «No hace falta».
          </p>
          <div className="flex gap-2">
            <button type="button" className="boton-suave" onClick={() => setDesmarcados(new Set())}>
              Marcar todo
            </button>
            <button
              type="button"
              className="boton-suave"
              onClick={() => setDesmarcados(new Set(propuestos.map((a) => a.ingredienteId)))}
            >
              Desmarcar todo
            </button>
          </div>
          <ul
            aria-label="Propuestas para la compra"
            className="flex flex-col gap-1 overflow-y-auto"
          >
            {propuestos.map((a) => (
              <li key={a.ingredienteId}>
                <label className="hover:bg-suave-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-1">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-[var(--marca)]"
                    checked={!desmarcados.has(a.ingredienteId)}
                    onChange={() => alternar(a.ingredienteId)}
                  />
                  <span className="flex flex-col">
                    <span className="text-base font-semibold">
                      {a.nombre}{" "}
                      <span className="font-normal">
                        · {formatearCantidad(a.cantidad, a.unidad)}
                      </span>
                    </span>
                    {a.motivos.length > 0 && (
                      <span className="text-tinta-suave text-sm">{a.motivos.join(" · ")}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="boton-suave" onClick={cerrar}>
              Ahora no
            </button>
            <button type="submit" className="boton">
              {marcados.length === 0 ? "No añadir nada" : `Añadir ${marcados.length} a la lista`}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
