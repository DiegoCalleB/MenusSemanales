"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { type FechaIso, diasEntre } from "@/dominio/fechas";
import {
  PROGRESO_VACIO,
  type ProgresoOnline,
  SUPERMERCADOS,
  articuloActual,
  contarEnCesta,
  enlaceDeBusqueda,
  type RevisionProducto,
  marcarEnCesta,
  nombreDeProducto,
  podarProgreso,
  revisarEnlaceDeProducto,
  quitarDeCesta,
  saltar,
} from "@/dominio/supermercado";
import {
  type ProductosOnline,
  claveDeProducto,
  guardarProductos,
  leerProductos,
} from "./productos-online";

export interface ArticuloOnline {
  clave: string;
  nombre: string;
  cantidad: string;
}

const CLAVE = "menus-semanales:compra-online";
/** Cuántos días se recuerda por dónde se iba (luego se empieza de nuevo). */
const DIAS_VIGENTE = 3;

function leerProgreso(hoy: FechaIso): ProgresoOnline {
  try {
    const crudo = JSON.parse(window.localStorage.getItem(CLAVE) ?? "null") as {
      dia?: unknown;
      hechos?: unknown;
      saltados?: unknown;
    } | null;
    const lista = (x: unknown): string[] =>
      Array.isArray(x) ? x.filter((c): c is string => typeof c === "string").slice(0, 500) : [];
    if (!crudo || typeof crudo.dia !== "string") return PROGRESO_VACIO;
    const pasados = diasEntre(crudo.dia as FechaIso, hoy);
    if (pasados < 0 || pasados > DIAS_VIGENTE) return PROGRESO_VACIO;
    return { hechos: lista(crudo.hechos), saltados: lista(crudo.saltados) };
  } catch {
    return PROGRESO_VACIO;
  }
}

function guardarProgreso(hoy: FechaIso, p: ProgresoOnline) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify({ dia: hoy, ...p }));
  } catch {
    // sin almacenamiento: el progreso dura hasta recargar
  }
}

/** Qué decirle a la persona cuando el enlace pegado no vale, con el motivo concreto. */
function textoDeRechazo(r: Extract<RevisionProducto, { ok: false }>, tienda: string): string {
  switch (r.motivo) {
    case "otro-sitio":
      return `Ese enlace es de ${r.host ?? "otro sitio"}, no de ${tienda}. Cópialo desde la página del producto en ${tienda}.`;
    case "busqueda":
      return `Ese enlace es una búsqueda, no un producto. Abre el producto en ${tienda}, toca compartir y copia su enlace.`;
    case "portada":
      return `Ese enlace es la portada de ${tienda}, no un producto. Abre el producto, toca compartir y copia su enlace.`;
    default:
      return "Eso no parece un enlace. Pega el enlace completo del producto (compartir → copiar enlace).";
  }
}

/** Pegar el enlace del producto elegido en la tienda para que la app se acuerde de él. */
function RecordarProducto({
  nombreTienda,
  alGuardar,
}: {
  nombreTienda: string;
  /** Devuelve null si se guardó, o el motivo por el que no vale. */
  alGuardar: (texto: string) => string | null;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [problema, setProblema] = useState("");

  function guardar(e: FormEvent) {
    e.preventDefault();
    const motivo = alGuardar(texto);
    setProblema(motivo ?? "");
    if (!motivo) setTexto("");
  }

  return (
    <details>
      <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
        <span aria-hidden="true">📌 </span>&nbsp;Recordar el producto que elijas
      </summary>
      <form onSubmit={guardar} className="flex flex-col gap-2 pb-1">
        <p className="text-tinta-suave text-sm">
          En {nombreTienda}, abre el producto y copia su enlace (compartir → copiar enlace). Pégalo
          aquí y la próxima vez este artículo abrirá directo ese producto.
        </p>
        <label htmlFor={`${id}-e`} className="sr-only">
          Enlace del producto
        </label>
        <input
          id={`${id}-e`}
          className="campo"
          inputMode="url"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Enlace del producto de ${nombreTienda}`}
        />
        {problema && (
          <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
            {problema}
          </p>
        )}
        <button type="submit" className="boton w-fit" disabled={texto.trim() === ""}>
          Guardar el producto
        </button>
      </form>
    </details>
  );
}

/**
 * Pasar la lista pendiente a la tienda online del supermercado, paso a paso (D-127, D-131). Los
 * supermercados no ofrecen API para que una app llene el carrito, así que la app guía: enseña un
 * artículo cada vez, abre su búsqueda en la tienda, y la persona lo añade a la cesta con su cuenta,
 * vuelve y lo marca. Se recuerda por dónde iba (en este móvil, unos días). La app no compra por
 * vosotros ni guarda contraseñas.
 */
export function ComprarOnline({
  articulos,
  hoy,
}: {
  articulos: readonly ArticuloOnline[];
  hoy: FechaIso;
}) {
  const super_ = SUPERMERCADOS[0];
  const [guardado, setGuardado] = useState<ProgresoOnline>(PROGRESO_VACIO);
  useEffect(() => {
    // Tras el primer pintado, para no desajustar el HTML del servidor con el del navegador.
    void Promise.resolve().then(() => setGuardado(leerProgreso(hoy)));
  }, [hoy]);

  const [productos, setProductos] = useState<ProductosOnline>({});
  useEffect(() => {
    void Promise.resolve().then(() => setProductos(leerProductos()));
  }, []);

  if (!super_ || articulos.length === 0) return null;

  const claves = articulos.map((a) => a.clave);
  const progreso = podarProgreso(guardado, claves);
  const cuenta = contarEnCesta(claves, progreso);
  const actual = articuloActual(claves, progreso);
  const ahora = articulos.find((a) => a.clave === actual);

  /** Recuerda el producto de un artículo; devuelve null si se guardó o por qué no vale el enlace. */
  function recordarProducto(nombre: string, texto: string): string | null {
    const r = revisarEnlaceDeProducto(super_!, texto);
    if (!r.ok) return textoDeRechazo(r, super_!.nombre);
    const nuevo = { ...productos, [claveDeProducto(nombre)]: r.enlace };
    setProductos(nuevo);
    guardarProductos(nuevo);
    return null;
  }
  function olvidarProducto(nombre: string) {
    const resto = { ...productos };
    delete resto[claveDeProducto(nombre)];
    setProductos(resto);
    guardarProductos(resto);
  }
  const productoDe = (nombre: string): string | undefined => productos[claveDeProducto(nombre)];

  function cambiar(f: (p: ProgresoOnline) => ProgresoOnline) {
    const nuevo = f(progreso);
    setGuardado(nuevo);
    guardarProgreso(hoy, nuevo);
  }

  return (
    <details className="flex flex-col gap-2">
      <summary className="boton-suave w-fit cursor-pointer list-none">
        <span aria-hidden="true">🛍️</span> Comprar online en {super_.nombre}
        {cuenta.hechos > 0 && (
          <span className="text-tinta-suave text-sm font-normal">
            ({cuenta.hechos}/{cuenta.total})
          </span>
        )}
      </summary>
      <div className="tarjeta mt-2 flex flex-col gap-3">
        <p className="text-tinta-suave text-base">
          {super_.nombre} no deja que otra app llene su cesta, así que vamos paso a paso: se abre la
          búsqueda de cada artículo, lo añades con tu cuenta y vuelves aquí. La app no compra por ti
          ni guarda tu contraseña.
        </p>
        <a
          className="boton-suave w-fit"
          href={super_.tienda}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir la tienda de {super_.nombre} ↗
        </a>

        <div
          role="group"
          aria-label="Asistente paso a paso"
          className="bg-suave-1 border-borde flex flex-col gap-2 rounded-2xl border p-3"
        >
          <p role="status" className="text-base font-bold">
            {cuenta.hechos} de {cuenta.total} en la cesta
          </p>
          <progress
            max={cuenta.total}
            value={cuenta.hechos}
            aria-label="Artículos ya en la cesta"
            className="h-1.5 w-full overflow-hidden rounded-full accent-[var(--marca)]"
          />
          {ahora ? (
            <>
              <p className="text-lg font-extrabold">
                Ahora: {ahora.nombre}
                {ahora.cantidad && (
                  <span className="text-tinta-suave font-normal"> · {ahora.cantidad}</span>
                )}
              </p>
              {productoDe(ahora.nombre) ? (
                <>
                  <p className="text-base font-semibold">
                    <span aria-hidden="true">⭐ </span>Tu producto:{" "}
                    {nombreDeProducto(productoDe(ahora.nombre) ?? "")}
                  </p>
                  <a
                    className="boton w-fit"
                    href={productoDe(ahora.nombre)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Siguiente: abrir tu producto de ${ahora.nombre} en ${super_.nombre}`}
                  >
                    Abrir mi producto ↗
                  </a>
                  <span className="flex flex-wrap gap-2">
                    <a
                      className="boton-suave"
                      href={enlaceDeBusqueda(super_, ahora.nombre)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buscar otro ${ahora.nombre} en ${super_.nombre}`}
                    >
                      Buscar otro ↗
                    </a>
                    <button
                      type="button"
                      className="boton-suave"
                      aria-label={`Olvidar el producto de ${ahora.nombre}`}
                      onClick={() => olvidarProducto(ahora.nombre)}
                    >
                      Olvidar producto
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <a
                    className="boton w-fit"
                    href={enlaceDeBusqueda(super_, ahora.nombre)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Siguiente: buscar ${ahora.nombre} en ${super_.nombre}`}
                  >
                    Buscar en {super_.nombre} ↗
                  </a>
                  <RecordarProducto
                    key={ahora.clave}
                    nombreTienda={super_.nombre}
                    alGuardar={(t) => recordarProducto(ahora.nombre, t)}
                  />
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="boton-suave"
                  onClick={() => cambiar((p) => marcarEnCesta(p, ahora.clave))}
                >
                  ✓ Ya está en la cesta
                </button>
                <button
                  type="button"
                  className="boton-suave"
                  onClick={() => cambiar((p) => saltar(p, ahora.clave))}
                >
                  Saltar
                </button>
              </div>
              <p className="text-tinta-suave text-sm">
                Se abre {super_.nombre} en otra pestaña: añádelo, vuelve aquí y pulsa «Ya está en la
                cesta».
              </p>
            </>
          ) : (
            <p className="text-base font-bold">
              <span aria-hidden="true">🎉 </span>¡Todo en la cesta! Ahora abre la tienda, revisa el
              pedido y paga.
            </p>
          )}
          {cuenta.hechos > 0 && (
            <button
              type="button"
              className="boton-suave w-fit"
              onClick={() => cambiar(() => PROGRESO_VACIO)}
            >
              Empezar de nuevo
            </button>
          )}
        </div>

        <ul aria-label={`Buscar en ${super_.nombre}`} className="flex flex-col gap-2">
          {articulos.map((a) => {
            const enCesta = progreso.hechos.includes(a.clave);
            return (
              <li
                key={a.clave}
                className="border-borde bg-fondo flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2 pl-3"
              >
                <span
                  className={`min-w-0 text-base font-semibold ${enCesta ? "text-tinta-suave line-through" : ""}`}
                >
                  {a.nombre}
                  {a.cantidad && (
                    <span className="text-tinta-suave font-normal"> · {a.cantidad}</span>
                  )}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className={enCesta ? "boton" : "boton-suave"}
                    aria-pressed={enCesta}
                    aria-label={`En la cesta: ${a.nombre}`}
                    onClick={() =>
                      cambiar((p) =>
                        enCesta ? quitarDeCesta(p, a.clave) : marcarEnCesta(p, a.clave),
                      )
                    }
                  >
                    {enCesta ? "✓ En la cesta" : "En la cesta"}
                  </button>
                  {productoDe(a.nombre) ? (
                    <a
                      className="boton-suave shrink-0"
                      href={productoDe(a.nombre)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir tu producto de ${a.nombre} en ${super_.nombre}`}
                    >
                      ⭐ Mi producto ↗
                    </a>
                  ) : (
                    <a
                      className="boton-suave shrink-0"
                      href={enlaceDeBusqueda(super_, a.nombre)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buscar ${a.nombre} en ${super_.nombre}`}
                    >
                      Buscar ↗
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
