"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TEXTO_BIENVENIDA_ANA, tocaBienvenidaAna } from "@/dominio/bienvenida";
import { CintaAnimal, useFondoCebra } from "./cinta-animal";
import { maullar } from "./maullido";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

const nadie = () => () => {};
const CLAVE = "menus-semanales:bienvenida-ana:vistas";

function leerVistas(): number {
  try {
    const n = Number(window.localStorage.getItem(CLAVE));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** La fecha de hoy en Madrid (YYYY-MM-DD), del reloj real: el regalo no sale antes de su día. */
function hoyReal(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

const CONFETI: ReadonlyArray<readonly [string, string]> = [
  ["🐱", "left-[8%] top-[7%]"],
  ["💖", "left-[82%] top-[6%] [animation-delay:0.3s]"],
  ["🎉", "left-[88%] top-[42%] [animation-delay:0.6s]"],
  ["🌷", "left-[5%] top-[46%] [animation-delay:0.9s]"],
  ["✨", "left-[14%] top-[86%] [animation-delay:0.2s]"],
  ["🐾", "left-[76%] top-[88%] [animation-delay:0.5s]"],
  ["⭐", "left-[46%] top-[3%] [animation-delay:0.8s]"],
  ["🎁", "left-[50%] top-[92%] [animation-delay:0.4s]"],
];

/**
 * Pantalla de bienvenida para Ana: un mensaje de cariño las primeras veces que entra (a partir del
 * 7 de noviembre), con un botón que maúlla. Se cuenta por móvil: al cerrarla suma una vista y,
 * pasadas las previstas, no vuelve a salir.
 */
export function BienvenidaAna() {
  const { estado, cargado } = useHogar();
  const [yoId] = useYo();
  const [cerrada, setCerrada] = useState(false);
  const [maullando, setMaullando] = useState(false);
  const fondoCebra = useFondoCebra();
  const titulo = useRef<HTMLHeadingElement>(null);
  const montado = useSyncExternalStore(
    nadie,
    () => true,
    () => false,
  );

  const nombre = estado.personas.find((p) => p.id === yoId)?.nombre;
  const pendiente =
    montado &&
    cargado &&
    !cerrada &&
    tocaBienvenidaAna({ nombre, hoy: hoyReal(), vistas: leerVistas() });

  useEffect(() => {
    if (pendiente) titulo.current?.focus();
  }, [pendiente]);

  if (!pendiente) return null;
  const t = TEXTO_BIENVENIDA_ANA;

  function cerrar() {
    try {
      window.localStorage.setItem(CLAVE, String(leerVistas() + 1));
    } catch {
      // sin almacenamiento: se cierra hasta recargar
    }
    setCerrada(true);
  }

  async function miau() {
    setMaullando(true);
    const duracion = await maullar();
    window.setTimeout(() => setMaullando(false), duracion ?? 1200);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bienvenida-ana-titulo"
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6 ${
        fondoCebra ? "fondo-cebra" : "from-suave-1 to-suave-2 bg-linear-to-br"
      }`}
    >
      {!fondoCebra && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETI.map(([e, pos]) => (
            <span key={e} className={`fiesta absolute text-3xl opacity-70 ${pos}`}>
              {e}
            </span>
          ))}
        </div>
      )}
      <article className="tarjeta relative my-auto flex w-full max-w-lg flex-col gap-4 overflow-hidden text-center sm:p-8">
        <CintaAnimal className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8" />
        <p aria-hidden="true" className="fiesta text-6xl">
          🎉
        </p>
        <h1
          ref={titulo}
          tabIndex={-1}
          id="bienvenida-ana-titulo"
          className="text-3xl font-extrabold tracking-tight focus-visible:outline-none sm:text-4xl"
        >
          {t.titulo}
        </h1>
        <p className="text-marca-fuerte text-lg font-bold">{t.subtitulo}</p>
        <div className="bg-suave-1 flex flex-col gap-3 rounded-2xl p-4 text-left text-lg">
          {t.parrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <p className="text-2xl font-extrabold">
          {t.despedida} <span aria-hidden="true">❤️</span>
        </p>
        {/* El dibujo es de trazo negro sobre fondo transparente: va sobre blanco en cualquier tema. */}
        <div className="mx-auto w-fit rounded-3xl bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/gatito.png"
            alt="Dibujo de un gatito"
            width={520}
            height={530}
            className={`mx-auto h-44 w-auto ${maullando ? "fiesta" : ""}`}
          />
        </div>
        <p className="text-tinta-suave text-lg font-semibold">{t.firma}</p>
        <button type="button" className="boton-suave justify-self-center text-lg" onClick={miau}>
          <span aria-hidden="true">🐾</span> Miauuu
        </button>
        <p role="status" className="text-tinta-suave min-h-6 text-base font-semibold">
          {maullando ? "¡Miauuuu! 😸" : ""}
        </p>
        <button type="button" className="boton justify-self-center text-lg" onClick={cerrar}>
          Entrar en ¡Hecho! ✅
        </button>
        <CintaAnimal otra className="-mx-4 -mb-4 sm:-mx-8 sm:-mb-8" />
      </article>
    </div>
  );
}
