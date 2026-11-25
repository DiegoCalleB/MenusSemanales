"use client";

import { useState } from "react";
import { parsearAgenda } from "@/dominio/agenda";
import { type ListaDeKeep as Lista, leerListaDeKeep } from "@/dominio/keep";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

/**
 * Una lista de Keep compartida o pegada (D-210): lo que falta, para elegir si es la compra o fechas y
 * tareas. Lo ya marcado en Keep no se importa.
 */
export function ListaDeKeep({
  lista,
  alTerminar,
  soloCompra = false,
}: {
  lista: Lista;
  alTerminar: (mensaje: string) => void;
  /** Pegada desde la compra: solo ofrece añadirla a la compra. */
  soloCompra?: boolean;
}) {
  const { estado, despachar } = useHogar();
  const [yo] = useYo();
  const n = lista.pendientes.length;
  const fechas = parsearAgenda(lista.pendientes.join("\n"), estado.hoy);
  const conFecha = fechas.conFecha.length;
  const parecenFechas = !soloCompra && n > 0 && conFecha * 2 >= n;

  function aLaCompra() {
    for (const nombre of lista.pendientes) despachar({ tipo: "manual/anadir", nombre });
    alTerminar(`${n === 1 ? "Añadido 1 artículo" : `Añadidos ${n} artículos`} a la compra.`);
  }
  function aFechas() {
    despachar({ tipo: "agenda/anadir", texto: lista.pendientes.join("\n"), personaId: yo });
    alTerminar(
      `Apuntadas ${conFecha} ${conFecha === 1 ? "fecha" : "fechas"}${
        n - conFecha > 0 ? ` y ${n - conFecha} ${n - conFecha === 1 ? "tarea" : "tareas"}` : ""
      }.`,
    );
  }

  return (
    <section aria-labelledby="lista-keep" className="tarjeta flex flex-col gap-3">
      <h2 id="lista-keep" className="text-lg font-extrabold">
        <span aria-hidden="true">📋 </span>Lista de Keep
      </h2>
      {n === 0 ? (
        <p className="text-base">No falta nada: todo está marcado. 🎉</p>
      ) : (
        <>
          <p className="text-base">
            Faltan <strong>{n}</strong>
            {lista.marcadas.length > 0 && ` (${lista.marcadas.length} ya marcadas no se importan)`}.
          </p>
          <ul aria-label="Lo que falta" className="text-base">
            {lista.pendientes.slice(0, 8).map((x) => (
              <li key={x}>· {x}</li>
            ))}
            {n > 8 && <li className="text-tinta-suave">y {n - 8} más</li>}
          </ul>
          {lista.encabezados.length > 0 && (
            <p className="text-tinta-suave text-sm">
              No cuento como artículo: {lista.encabezados.join(", ")}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={parecenFechas ? "boton-suave" : "boton"}
              onClick={aLaCompra}
            >
              🛒 A la compra ({n})
            </button>
            <button
              type="button"
              className={parecenFechas ? "boton" : "boton-suave"}
              onClick={aFechas}
            >
              📅 A fechas y tareas
              {conFecha > 0 ? ` (${conFecha} con fecha)` : ""}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** «Pegar una lista de Keep» en la compra (D-210): se pega, se ve lo que falta y se añade. */
export function PegarListaDeKeep() {
  const [texto, setTexto] = useState("");
  const [hecho, setHecho] = useState("");
  const lista = texto.trim() ? leerListaDeKeep(texto) : null;
  return (
    <details className="tarjeta">
      <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
        📋 Pegar una lista de Keep
      </summary>
      <div className="flex flex-col gap-3 pt-2">
        <p className="text-tinta-suave text-sm">
          En Keep, abre la lista, toca ⋮ → Enviar → «¡Hecho!», o copia el texto y pégalo aquí. Solo
          entra lo que falta por marcar.
        </p>
        <textarea
          className="campo min-h-28"
          aria-label="Lista de Keep"
          value={texto}
          placeholder={"☐ Leche\n☐ Huevos\n☑ Pan"}
          onChange={(e) => {
            setTexto(e.target.value);
            setHecho("");
          }}
        />
        {hecho && (
          <p role="status" className="text-base font-semibold">
            ✅ {hecho}
          </p>
        )}
        {lista && !hecho && (
          <ListaDeKeep
            soloCompra
            lista={lista}
            alTerminar={(m) => {
              setHecho(m);
              setTexto("");
            }}
          />
        )}
      </div>
    </details>
  );
}
