"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { felicitacionesDeHoy } from "@/dominio/cumples";
import { useHogar } from "./proveedor-hogar";
import { leerRegaloRecibido } from "./regalo-recibido";
import { useYo } from "./yo";

const nadie = () => () => {};
const claveVista = (id: string, anio: string) => `menus-semanales:bienvenida-cumple:${id}:${anio}`;

function yaVista(clave: string): boolean {
  try {
    return window.localStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}

/** Confeti de CSS (sin `style` en línea: la CSP lo bloquea). Se detiene con «movimiento reducido». */
const CONFETI: ReadonlyArray<readonly [string, string]> = [
  ["🎉", "left-[6%] top-[8%]"],
  ["✨", "left-[80%] top-[6%] [animation-delay:0.3s]"],
  ["🎈", "left-[88%] top-[40%] [animation-delay:0.6s]"],
  ["🥳", "left-[4%] top-[45%] [animation-delay:0.9s]"],
  ["💖", "left-[12%] top-[85%] [animation-delay:0.2s]"],
  ["🎊", "left-[75%] top-[88%] [animation-delay:0.5s]"],
  ["⭐", "left-[45%] top-[3%] [animation-delay:0.8s]"],
  ["🎁", "left-[48%] top-[92%] [animation-delay:0.4s]"],
];

/**
 * Una sola vez al año, el día de su cumpleaños, a quien cumple le sale una pantalla de fiesta con
 * el mensaje de quien le ha preparado el regalo (el de «/regalo», guardado en este móvil) antes de
 * ver la app. Si no hay mensaje, el de siempre. «Ver la app» la cierra y no vuelve a salir ese año.
 */
export function BienvenidaCumple() {
  const { estado, cargado } = useHogar();
  const [yoId] = useYo();
  const [cerrada, setCerrada] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);

  const f = yoId
    ? felicitacionesDeHoy(estado.cumples, estado.hoy).find((x) => x.cumple.personaId === yoId)
    : undefined;
  const clave = f ? claveVista(f.cumple.id, estado.hoy.slice(0, 4)) : null;
  const montado = useSyncExternalStore(
    nadie,
    () => true,
    () => false,
  );
  const pendiente = montado && cargado && !!clave && !cerrada && !yaVista(clave);
  const regalo = pendiente ? leerRegaloRecibido() : null;

  useEffect(() => {
    if (pendiente) boton.current?.focus();
  }, [pendiente]);

  if (!pendiente || !f || !clave) return null;

  function cerrar() {
    try {
      window.localStorage.setItem(clave as string, "1");
    } catch {
      // sin almacenamiento: se cierra hasta recargar
    }
    setCerrada(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bienvenida-titulo"
      className="from-suave-1 to-suave-2 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-linear-to-br p-4"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETI.map(([e, pos]) => (
          <span key={e} className={`fiesta absolute text-3xl opacity-70 ${pos}`}>
            {e}
          </span>
        ))}
      </div>
      <article className="tarjeta relative flex w-full max-w-lg flex-col gap-5 text-center sm:p-8">
        <p aria-hidden="true" className="fiesta text-6xl">
          🎂
        </p>
        <h1 id="bienvenida-titulo" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          ¡Feliz cumpleaños, {f.cumple.nombre}!
        </h1>
        {f.edad !== null && (
          <p className="text-tinta-suave text-lg font-semibold">Hoy cumples {f.edad}</p>
        )}
        <blockquote className="bg-suave-1 rounded-2xl p-4 text-lg whitespace-pre-line">
          {regalo?.m ? regalo.m : f.paraEl}
        </blockquote>
        {regalo && (
          <p className="text-tinta-suave text-lg font-semibold">Con cariño, {regalo.d} ❤️</p>
        )}
        <section className="border-borde rounded-2xl border p-4 text-left">
          <h2 className="mb-2 text-lg font-extrabold">Tu regalo: ¡Hecho! ✅</h2>
          <ul className="flex flex-col gap-2 text-base">
            <li>✨ Cenas propuestas cada semana, pensadas para el menú del cole</li>
            <li>🛒 La lista de la compra se hace sola</li>
            <li>🤝 Lo de casa, repartido entre los dos y a la vista</li>
          </ul>
        </section>
        <button
          ref={boton}
          type="button"
          className="boton justify-self-center text-lg"
          onClick={cerrar}
        >
          Ver mi regalo 🎁
        </button>
      </article>
    </div>
  );
}
