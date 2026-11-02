"use client";

import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import { planificarCocinado, proximosACaducar } from "@/dominio/despensa";
import { type ItemDespensa, type Ubicacion, UBICACIONES } from "@/dominio/tipos";
import {
  estadoDeCaducidad,
  formatearCantidad,
  formatearNumero,
  NOMBRE_UBICACION,
  pasoDe,
} from "../formato";
import { IconoAlerta, IconoMas, IconoMenos, IconoReloj } from "../iconos";
import { useHogar } from "../proveedor-hogar";

export function DespensaVista() {
  const { estado } = useHogar();
  const [ubicacion, setUbicacion] = useState<Ubicacion>("nevera");
  const idBase = useId();
  const pestanas = useRef<Array<HTMLButtonElement | null>>([]);

  const ingredientes = useMemo(
    () => new Map(estado.ingredientes.map((i) => [i.id, i])),
    [estado.ingredientes],
  );
  const conStock = (u: Ubicacion) =>
    estado.despensa.filter((i) => i.ubicacion === u && i.cantidad > 0);
  const items = conStock(ubicacion).sort((a, b) =>
    (ingredientes.get(a.ingredienteId)?.nombre ?? "").localeCompare(
      ingredientes.get(b.ingredienteId)?.nombre ?? "",
      "es",
    ),
  );

  const urgentes = proximosACaducar(estado.despensa, estado.hoy, 3);
  const caducados = estado.despensa.filter(
    (i) => i.cantidad > 0 && estadoDeCaducidad(estado.hoy, i.caducaEn).tipo === "caducado",
  );

  function teclado(evento: KeyboardEvent, indice: number) {
    const mover = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (mover === 0) return;
    evento.preventDefault();
    const siguiente = (indice + mover + UBICACIONES.length) % UBICACIONES.length;
    const destino = UBICACIONES[siguiente];
    if (destino) {
      setUbicacion(destino);
      pestanas.current[siguiente]?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Despensa y nevera <span aria-hidden="true">🧊</span>
        </h1>
      </header>

      {(caducados.length > 0 || urgentes.length > 0) && (
        <section
          aria-labelledby="caduca"
          className="tarjeta border-aviso-texto/30 bg-aviso-fondo text-aviso-texto"
        >
          <h2 id="caduca" className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <IconoAlerta width={22} height={22} />
            Conviene gastarlo ya
          </h2>
          <ul className="flex flex-col gap-1 text-base">
            {[...caducados, ...urgentes.filter((i) => !caducados.includes(i))].map((i) => {
              const ing = ingredientes.get(i.ingredienteId);
              const cad = estadoDeCaducidad(estado.hoy, i.caducaEn);
              return (
                <li
                  key={`${i.ingredienteId}-${i.ubicacion}`}
                  className="flex flex-wrap items-center justify-between gap-x-3"
                >
                  <span>
                    <strong>{ing?.nombre}</strong> ({NOMBRE_UBICACION[i.ubicacion]}) ·{" "}
                    {cad.tipo === "caducado"
                      ? `caducó hace ${cad.dias} ${cad.dias === 1 ? "día" : "días"}`
                      : cad.tipo === "pronto"
                        ? cad.texto.toLowerCase()
                        : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section aria-label="Existencias" className="flex min-w-0 flex-col gap-4">
          <div
            role="tablist"
            aria-label="Ubicación"
            className="border-borde bg-superficie grid grid-cols-3 gap-1 rounded-2xl border p-1"
          >
            {UBICACIONES.map((u, indice) => {
              const seleccionada = u === ubicacion;
              return (
                <button
                  key={u}
                  ref={(el) => {
                    pestanas.current[indice] = el;
                  }}
                  role="tab"
                  type="button"
                  id={`${idBase}-tab-${u}`}
                  aria-selected={seleccionada}
                  aria-controls={`${idBase}-panel`}
                  tabIndex={seleccionada ? 0 : -1}
                  onClick={() => setUbicacion(u)}
                  onKeyDown={(e) => teclado(e, indice)}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-2 text-base leading-tight sm:flex-row sm:gap-2 ${
                    seleccionada
                      ? "bg-marca text-sobre-marca font-semibold"
                      : "text-tinta hover:bg-fondo"
                  }`}
                >
                  <span>{NOMBRE_UBICACION[u]}</span>
                  <span className="text-sm opacity-90">({conStock(u).length})</span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`${idBase}-panel`}
            aria-labelledby={`${idBase}-tab-${ubicacion}`}
            tabIndex={0}
          >
            {items.length === 0 ? (
              <p className="tarjeta text-tinta-suave text-base">
                No hay nada en {NOMBRE_UBICACION[ubicacion].toLowerCase()}.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <Tarjeta key={`${item.ingredienteId}-${item.ubicacion}`} item={item} />
                ))}
              </ul>
            )}
          </div>
        </section>

        <PanelCocinar />
      </div>
    </div>
  );
}

function Tarjeta({ item }: { item: ItemDespensa }) {
  const { estado, despachar } = useHogar();
  const ing = estado.ingredientes.find((i) => i.id === item.ingredienteId);
  if (!ing) return null;
  const cad = estadoDeCaducidad(estado.hoy, item.caducaEn);
  const bajoMinimo = item.minimo !== null && item.cantidad < item.minimo;
  const paso = pasoDe(ing.unidad);
  const textoPaso = formatearCantidad(paso, ing.unidad);
  return (
    <li className="tarjeta flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-lg leading-snug font-semibold">{ing.nombre}</h3>
        <p
          className="shrink-0 text-lg font-semibold tabular-nums"
          aria-label={`Cantidad: ${formatearCantidad(item.cantidad, ing.unidad)}`}
        >
          {formatearCantidad(item.cantidad, ing.unidad)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {cad.tipo === "caducado" && (
          <span className="etiqueta bg-peligro-fondo text-peligro-texto">
            <IconoAlerta width={16} height={16} />
            Caducado
          </span>
        )}
        {cad.tipo === "pronto" && (
          <span className="etiqueta bg-aviso-fondo text-aviso-texto">
            <IconoReloj width={16} height={16} />
            {cad.texto}
          </span>
        )}
        {bajoMinimo && item.minimo !== null && (
          <span className="etiqueta bg-aviso-fondo text-aviso-texto">
            Bajo mínimo ({formatearCantidad(item.minimo, ing.unidad)})
          </span>
        )}
      </div>

      {cad.tipo === "caducado" ? (
        <button
          type="button"
          className="boton-suave w-full"
          onClick={() =>
            despachar({
              tipo: "tirarCaducado",
              ingredienteId: item.ingredienteId,
              ubicacion: item.ubicacion,
            })
          }
        >
          Tirar lo caducado
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="boton-suave"
            aria-label={`Quitar ${textoPaso} de ${ing.nombre}`}
            disabled={item.cantidad < paso}
            onClick={() =>
              despachar({
                tipo: "ajustar",
                ingredienteId: item.ingredienteId,
                ubicacion: item.ubicacion,
                delta: -paso,
              })
            }
          >
            <IconoMenos width={20} height={20} />
          </button>
          <span className="text-tinta-suave text-sm whitespace-nowrap">±{textoPaso}</span>
          <button
            type="button"
            className="boton-suave"
            aria-label={`Añadir ${textoPaso} de ${ing.nombre}`}
            onClick={() =>
              despachar({
                tipo: "ajustar",
                ingredienteId: item.ingredienteId,
                ubicacion: item.ubicacion,
                delta: paso,
              })
            }
          >
            <IconoMas width={20} height={20} />
          </button>
        </div>
      )}
    </li>
  );
}

function PanelCocinar() {
  const { estado, despachar } = useHogar();
  const idBase = useId();
  const [platoId, setPlatoId] = useState(estado.platos[0]?.id ?? "");
  const [raciones, setRaciones] = useState(3);
  const plato = estado.platos.find((p) => p.id === platoId);
  const plan =
    plato && raciones > 0
      ? planificarCocinado({ plato, raciones, despensa: estado.despensa, hoy: estado.hoy })
      : null;
  const idSelect = `${idBase}-plato`;
  const idRaciones = `${idBase}-raciones`;

  return (
    <section aria-labelledby="cocinar" className="tarjeta flex flex-col gap-4 lg:sticky lg:top-6">
      <h2 id="cocinar" className="text-lg font-semibold">
        Cocinar y descontar
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={idSelect} className="text-base font-medium">
          Plato
        </label>
        <select
          id={idSelect}
          className="campo"
          value={platoId}
          onChange={(e) => setPlatoId(e.target.value)}
        >
          {estado.platos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idRaciones} className="text-base font-medium">
          Raciones de adulto
        </label>
        <input
          id={idRaciones}
          className="campo"
          type="number"
          inputMode="decimal"
          min={0.5}
          max={20}
          step={0.5}
          value={raciones}
          onChange={(e) => setRaciones(Number(e.target.value))}
        />
        <p className="text-tinta-suave text-sm">
          Dos adultos y dos niñas (media ración cada una) son 3.
        </p>
      </div>

      {plan && (
        <div aria-live="polite" className="flex flex-col gap-2 text-base">
          {plan.movimientos.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {plan.movimientos.map((m) => {
                const ing = estado.ingredientes.find((i) => i.id === m.ingredienteId);
                return (
                  <li
                    key={`${m.ingredienteId}-${m.ubicacion}`}
                    className="flex justify-between gap-3"
                  >
                    <span>
                      {ing?.nombre}{" "}
                      <span className="text-tinta-suave">
                        ({NOMBRE_UBICACION[m.ubicacion].toLowerCase()})
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      −{formatearNumero(-m.delta)} {ing?.unidad}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-tinta-suave">No hay nada en casa para este plato.</p>
          )}
          {plan.faltantes.length > 0 && (
            <p className="etiqueta bg-aviso-fondo text-aviso-texto !items-start !rounded-xl !px-3 !py-2">
              <IconoAlerta width={18} height={18} className="mt-0.5 shrink-0" />
              <span>
                Faltaría:{" "}
                {plan.faltantes
                  .map((f) => {
                    const ing = estado.ingredientes.find((i) => i.id === f.ingredienteId);
                    return `${ing?.nombre} (${formatearNumero(f.cantidad)} ${ing?.unidad})`;
                  })
                  .join(", ")}
              </span>
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="boton w-full"
        disabled={!plan || plan.movimientos.length === 0}
        onClick={() => despachar({ tipo: "cocinar", platoId, raciones })}
      >
        Cocinar y descontar
      </button>
    </section>
  );
}
