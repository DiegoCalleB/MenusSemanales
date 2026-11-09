"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { seccionesDeCompra } from "@/aplicacion/compartir";
import { articulosPendientes, articulosQuitados, MAX_LARGO_CANTIDAD } from "@/aplicacion/estado";
import { textoCompra } from "@/dominio/compartir";
import { PASO_POR_UNIDAD } from "@/dominio/compra";
import {
  CATEGORIAS,
  type Categoria,
  NOMBRE_CATEGORIA,
  claveArticulo,
  clasificarArticulo,
} from "@/dominio/habituales";
import type { Unidad } from "@/dominio/tipos";
import { BotonesCompartir } from "../compartir-botones";
import { ComprarOnline } from "../comprar-online";
import { CintaAnimal } from "../cinta-animal";
import { EntradaCompra } from "../entrada-compra";
import { OrdenarConIa } from "../ordenar-con-ia";
import { formatearCantidad } from "../formato";
import { useHogar } from "../proveedor-hogar";

type Vista = "secciones" | "lista" | "comida" | "tienda";
const VISTAS: ReadonlyArray<{ id: Vista; texto: string }> = [
  { id: "secciones", texto: "Secciones" },
  { id: "lista", texto: "Lista" },
  { id: "comida", texto: "Por comida" },
  { id: "tienda", texto: "Tienda" },
];
const CLAVE_VISTA = "menus-semanales:vista-compra";

/** Un artículo de la lista, venga de donde venga (calculado por el menú o apuntado a mano). */
interface Item {
  clave: string;
  /** Qué tipo de fila es: define qué pasa al marcarla y qué se puede editar. */
  tipo: "auto" | "manual" | "auto-hecho" | "manual-hecho";
  id: string;
  nombre: string;
  cantidad: string;
  detalle?: string;
  categoria: Categoria;
  /** Solo para los calculados: lo que hace falta y cómo se mide. */
  numero?: number;
  unidad?: Unidad;
  calculada?: number;
  /** Solo para los hechos: la operación que se deshace al desmarcar. */
  operacionId?: string;
  /** Primer motivo, para la vista «Por comida». */
  grupo: string;
}

const textoCantidad = (n: number, u: Unidad) => formatearCantidad(n, u);

export function CompraVista() {
  const { estado, despachar } = useHogar();
  const [vista, setVista] = useState<Vista>("secciones");
  const [editando, setEditando] = useState<string | null>(null);
  const [ocultarComprado, setOcultarComprado] = useState(false);

  useEffect(() => {
    try {
      const guardada = window.localStorage.getItem(CLAVE_VISTA);
      if (VISTAS.some((v) => v.id === guardada)) {
        // Se lee una sola vez, ya en el navegador, para que el servidor y el cliente pinten lo mismo.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVista(guardada as Vista);
      }
    } catch {
      /* sin almacenamiento: se queda la vista por defecto */
    }
  }, []);
  function elegirVista(v: Vista) {
    setVista(v);
    setEditando(null);
    try {
      window.localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      /* no pasa nada */
    }
  }

  const calculados = articulosPendientes(estado);
  const quitados = articulosQuitados(estado);
  const pendientes: Item[] = [
    ...estado.manuales
      .filter((m) => !m.comprado)
      .map<Item>((m) => ({
        clave: `m-${m.id}`,
        tipo: "manual",
        id: m.id,
        nombre: m.nombre,
        cantidad: m.cantidad ?? "",
        categoria: m.categoria ?? clasificarArticulo(m.nombre),
        grupo: "Apuntado a mano",
      })),
    ...calculados.map<Item>((a) => ({
      clave: `a-${a.ingredienteId}`,
      tipo: "auto",
      id: a.ingredienteId,
      nombre: a.nombre,
      cantidad: textoCantidad(a.cantidad, a.unidad),
      detalle: a.motivos.join(" · "),
      categoria: a.seccion as Categoria,
      numero: a.cantidad,
      unidad: a.unidad,
      ...(a.calculada !== undefined ? { calculada: a.calculada } : {}),
      grupo: a.motivos[0] ?? "Otros",
    })),
  ];
  const hechos: Item[] = [
    ...estado.compras.map<Item>((c) => ({
      clave: `c-${c.id}`,
      tipo: "auto-hecho",
      id: c.id,
      nombre: c.nombre,
      cantidad: textoCantidad(c.cantidad, c.unidad),
      categoria: "otros",
      operacionId: c.operacionId,
      grupo: "Comprado",
    })),
    ...estado.manuales
      .filter((m) => m.comprado)
      .map<Item>((m) => ({
        clave: `m-${m.id}`,
        tipo: "manual-hecho",
        id: m.id,
        nombre: m.nombre,
        cantidad: m.cantidad ?? "",
        categoria: "otros",
        grupo: "Comprado",
      })),
  ];

  const compra = seccionesDeCompra(estado);
  const textoDeCompra = textoCompra(compra.secciones, compra.manuales);
  const total = pendientes.length + hechos.length;
  const modoTienda = vista === "tienda";

  function alternar(i: Item) {
    if (i.tipo === "auto") despachar({ tipo: "comprar", ingredienteId: i.id });
    else if (i.tipo === "auto-hecho" && i.operacionId)
      despachar({ tipo: "deshacer", operacionId: i.operacionId });
    else despachar({ tipo: "manual/alternar", id: i.id });
  }

  const fila = (i: Item) => (
    <FilaCompra
      key={i.clave}
      item={i}
      grande={modoTienda}
      editando={editando === i.clave}
      alAbrir={() => setEditando(editando === i.clave ? null : i.clave)}
      alMarcar={() => alternar(i)}
    />
  );

  const grupos = agrupar(pendientes, vista);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Lista de la compra <span aria-hidden="true">🛒</span>
          </h1>
          {total > 0 && (
            <span className="shrink-0 text-base font-medium tabular-nums">
              {hechos.length} de {total}
            </span>
          )}
        </div>
        {total > 0 && (
          <progress
            max={total}
            value={hechos.length}
            aria-label="Progreso de la compra"
            className="h-1.5 w-full overflow-hidden rounded-full accent-[var(--marca)]"
          />
        )}
        <div role="group" aria-label="Vista de la lista" className="grid grid-cols-4 gap-1">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={vista === v.id}
              className={`min-h-11 rounded-xl px-1 text-sm font-semibold ${
                vista === v.id ? "boton" : "boton-suave"
              }`}
              onClick={() => elegirVista(v.id)}
            >
              {v.texto}
            </button>
          ))}
        </div>
      </header>

      {!modoTienda && (
        <EntradaCompra yaEnLista={new Set(pendientes.map((i) => claveArticulo(i.nombre)))} />
      )}

      {!modoTienda && <OrdenarConIa yaEnLista={pendientes.map((i) => i.nombre)} />}

      {!modoTienda && (
        <ComprarOnline
          hoy={estado.hoy}
          articulos={pendientes.map((i) => ({
            clave: i.clave,
            nombre: i.nombre,
            cantidad: i.cantidad,
          }))}
        />
      )}

      {pendientes.length === 0 ? (
        <section
          aria-label="Lista vacía"
          className="from-suave-1 to-suave-3 border-borde flex flex-col items-center gap-1 overflow-hidden rounded-3xl border bg-linear-to-br px-4 pb-8 text-center"
        >
          <CintaAnimal className="-mx-4 mb-6 self-stretch" />
          <p aria-hidden="true" className="text-5xl">
            {total > 0 ? "🎉" : "🧺"}
          </p>
          <h2 className="text-xl font-extrabold">
            {total > 0 ? "¡Todo comprado!" : "Nada que comprar por ahora"}
          </h2>
          <p className="text-tinta-suave max-w-xs text-base">
            {total > 0
              ? "Ya está todo en la cesta. Buen trabajo."
              : "Cuando elijáis una cena, lo que haga falta aparecerá aquí solo. También puedes apuntar algo arriba, o tocar «Lo de siempre»."}
          </p>
        </section>
      ) : (
        <div className="tarjeta flex flex-col gap-1 p-2 sm:p-3">
          {grupos.map(({ clave, titulo, items }) => (
            <section key={clave} aria-label={titulo || "Lista"}>
              {titulo && (
                <h2 className="text-tinta-suave px-2 pt-2 text-sm font-bold tracking-wide">
                  {titulo} <span className="font-medium">· {items.length}</span>
                </h2>
              )}
              <ul className="divide-borde divide-y">{items.map(fila)}</ul>
            </section>
          ))}
        </div>
      )}

      {hechos.length > 0 && (
        <section aria-labelledby="s-comprado" className="tarjeta p-2 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2">
            <h2 id="s-comprado" className="text-base font-bold">
              Comprado ({hechos.length})
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
          {!ocultarComprado && <ul className="divide-borde divide-y">{hechos.map(fila)}</ul>}
        </section>
      )}

      {!modoTienda && <BotonesCompartir titulo="Lista de la compra" texto={textoDeCompra} />}

      {!modoTienda && quitados.length > 0 && (
        <details className="tarjeta p-2 sm:p-3">
          <summary className="min-h-11 cursor-pointer px-2 py-2 text-base font-bold">
            No hace falta ({quitados.length})
          </summary>
          <ul className="divide-borde divide-y">
            {quitados.map((q) => (
              <li
                key={q.ingredienteId}
                className="flex min-h-11 items-center justify-between gap-2 px-2"
              >
                <span className="text-tinta-suave min-w-0 text-base line-through">{q.nombre}</span>
                <button
                  type="button"
                  className="boton-suave"
                  onClick={() =>
                    despachar({ tipo: "compra/restablecer", ingredienteId: q.ingredienteId })
                  }
                >
                  Volver a poner {q.nombre}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function agrupar(items: readonly Item[], vista: Vista) {
  if (vista === "lista") return [{ clave: "todo", titulo: "", items: [...items] }];
  if (vista === "comida") {
    const mapa = new Map<string, Item[]>();
    for (const i of items) mapa.set(i.grupo, [...(mapa.get(i.grupo) ?? []), i]);
    return [...mapa.entries()].map(([titulo, its]) => ({ clave: titulo, titulo, items: its }));
  }
  // Secciones (y modo tienda): en el orden del recorrido del súper.
  return CATEGORIAS.flatMap((c) => {
    const its = items.filter((i) => i.categoria === c);
    return its.length === 0
      ? []
      : [
          {
            clave: c,
            titulo: `${NOMBRE_CATEGORIA[c].emoji} ${NOMBRE_CATEGORIA[c].nombre}`,
            items: its,
          },
        ];
  });
}

/**
 * Una fila de una línea, como en Keep: casilla, nombre y cantidad. Tocar el nombre abre la edición
 * en el sitio; tocar la casilla marca. En «Tienda» la fila es más grande y no se edita.
 */
function FilaCompra({
  item,
  grande,
  editando,
  alAbrir,
  alMarcar,
}: {
  item: Item;
  grande: boolean;
  editando: boolean;
  alAbrir: () => void;
  alMarcar: () => void;
}) {
  const hecho = item.tipo === "auto-hecho" || item.tipo === "manual-hecho";
  const editable = !hecho && !grande;
  return (
    <li className="py-0.5">
      <div className={`flex items-center gap-1 ${grande ? "min-h-16" : "min-h-11"}`}>
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={hecho}
            onChange={alMarcar}
            aria-label={item.nombre}
            className="size-6 accent-[var(--marca)]"
          />
        </label>
        {editable ? (
          <button
            type="button"
            aria-expanded={editando}
            onClick={alAbrir}
            className="min-h-11 min-w-0 flex-1 rounded-lg px-1 text-left"
          >
            <span className="block truncate text-base">{item.nombre}</span>
            {item.detalle && (
              <span className="text-tinta-suave block truncate text-xs">{item.detalle}</span>
            )}
          </button>
        ) : (
          <span className="min-w-0 flex-1 px-1">
            <span
              className={`block truncate ${grande ? "text-xl" : "text-base"} ${
                hecho ? "text-tinta-suave line-through" : ""
              }`}
            >
              {item.nombre}
            </span>
            {item.detalle && !grande && (
              <span className="text-tinta-suave block truncate text-xs">{item.detalle}</span>
            )}
          </span>
        )}
        {item.cantidad && (
          <span
            className={`shrink-0 px-1 font-medium tabular-nums ${grande ? "text-lg" : "text-sm"} ${
              item.calculada !== undefined ? "text-marca-fuerte" : "text-tinta-suave"
            }`}
          >
            {item.cantidad}
          </span>
        )}
      </div>
      {editando && editable && <Edicion item={item} alCerrar={alAbrir} />}
    </li>
  );
}

function Edicion({ item, alCerrar }: { item: Item; alCerrar: () => void }) {
  return item.tipo === "manual" ? (
    <EdicionManual item={item} alCerrar={alCerrar} />
  ) : (
    <EdicionCalculada item={item} alCerrar={alCerrar} />
  );
}

function EdicionManual({ item, alCerrar }: { item: Item; alCerrar: () => void }) {
  const { despachar } = useHogar();
  const id = useId();
  const [nombre, setNombre] = useState(item.nombre);
  const [cantidad, setCantidad] = useState(item.cantidad);

  function guardar(e: FormEvent) {
    e.preventDefault();
    despachar({ tipo: "manual/editar", id: item.id, nombre, cantidad });
    alCerrar();
  }

  return (
    <form onSubmit={guardar} className="bg-fondo mb-1 flex flex-col gap-2 rounded-xl p-2">
      <div className="flex gap-2">
        <label htmlFor={`${id}-n`} className="sr-only">
          Nombre de {item.nombre}
        </label>
        <input
          id={`${id}-n`}
          className="campo min-w-0 flex-1"
          value={nombre}
          maxLength={80}
          autoFocus
          onChange={(e) => setNombre(e.target.value)}
        />
        <label htmlFor={`${id}-c`} className="sr-only">
          Cantidad de {item.nombre}
        </label>
        <input
          id={`${id}-c`}
          className="campo w-24"
          value={cantidad}
          maxLength={MAX_LARGO_CANTIDAD}
          placeholder="Cuánto"
          inputMode="text"
          onChange={(e) => setCantidad(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="boton">
          Guardar
        </button>
        <button
          type="button"
          className="boton-suave"
          onClick={() => despachar({ tipo: "manual/borrar", id: item.id })}
        >
          Borrar {item.nombre}
        </button>
        <button type="button" className="boton-suave" onClick={alCerrar}>
          Cerrar
        </button>
      </div>
    </form>
  );
}

function EdicionCalculada({ item, alCerrar }: { item: Item; alCerrar: () => void }) {
  const { despachar } = useHogar();
  const unidad = item.unidad ?? "ud";
  const paso = PASO_POR_UNIDAD[unidad];
  const actual = item.numero ?? 0;
  const poner = (n: number) =>
    despachar({ tipo: "compra/cantidad", ingredienteId: item.id, cantidad: Math.max(0, n) });

  return (
    <div className="bg-fondo mb-1 flex flex-col gap-2 rounded-xl p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="boton-suave"
          aria-label={`Menos ${item.nombre}`}
          onClick={() => poner(actual - paso)}
        >
          −
        </button>
        <span className="min-w-20 text-center text-base font-bold tabular-nums">
          {item.cantidad}
        </span>
        <button
          type="button"
          className="boton-suave"
          aria-label={`Más ${item.nombre}`}
          onClick={() => poner(actual + paso)}
        >
          +
        </button>
        {item.calculada !== undefined && (
          <span className="text-tinta-suave text-sm">
            La app calculó {textoCantidad(item.calculada, unidad)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {item.calculada !== undefined && (
          <button
            type="button"
            className="boton-suave"
            onClick={() => despachar({ tipo: "compra/restablecer", ingredienteId: item.id })}
          >
            Restablecer {item.nombre}
          </button>
        )}
        <button type="button" className="boton-suave" onClick={() => poner(0)}>
          No hace falta {item.nombre}
        </button>
        <button type="button" className="boton-suave" onClick={alCerrar}>
          Cerrar
        </button>
      </div>
      <p className="text-tinta-suave text-xs">
        El nombre viene del plato; aquí solo se cambia cuánto comprar.
      </p>
    </div>
  );
}
