"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type Regalo, decodificarRegalo, enlaceDeRegalo } from "@/aplicacion/regalo";
import { CintaAnimal } from "@/componentes/cinta-animal";
import { guardarRegaloRecibido } from "@/componentes/regalo-recibido";

const BORRADOR: Regalo = {
  p: "Ana",
  d: "Diego",
  m: "Feliz cumpleaños. Esto es para que organizar las comidas y la casa pese menos y se reparta mejor entre los dos.",
};

/**
 * Un regalo en un enlace: quien lo prepara escribe el mensaje y copia el enlace; quien lo recibe lo
 * abre y ve la pantalla de regalo. El mensaje va en el fragmento de la URL (nunca llega al servidor).
 */
const suscribirHash = (aviso: () => void) => {
  window.addEventListener("hashchange", aviso);
  return () => window.removeEventListener("hashchange", aviso);
};
const nadie = () => () => {};

export function RegaloVista() {
  // El fragmento solo existe en el navegador: en el servidor no hay nada que leer.
  const hash = useSyncExternalStore(
    suscribirHash,
    () => window.location.hash,
    () => "",
  );
  const enNavegador = useSyncExternalStore(
    nadie,
    () => true,
    () => false,
  );
  const regalo = useMemo(() => decodificarRegalo(hash), [hash]);

  if (!enNavegador) return <main className="min-h-dvh" />;
  return regalo ? <Abrir regalo={regalo} /> : <Preparar />;
}

function Abrir({ regalo }: { regalo: Regalo }) {
  // Se recuerda en este móvil para volver a enseñar el mensaje cuando llegue el día.
  useEffect(() => guardarRegaloRecibido(regalo), [regalo]);
  return (
    <main className="from-suave-1 to-suave-2 flex min-h-dvh items-center justify-center bg-linear-to-br p-4">
      <article className="tarjeta flex w-full max-w-lg flex-col gap-5 overflow-hidden text-center sm:p-8">
        <CintaAnimal className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-8" />
        <p aria-hidden="true" className="text-5xl motion-safe:animate-bounce">
          🎂
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          ¡Feliz cumpleaños, {regalo.p}!
        </h1>
        {regalo.m && (
          <blockquote className="bg-suave-1 rounded-2xl p-4 text-lg whitespace-pre-line">
            {regalo.m}
          </blockquote>
        )}
        <p className="text-tinta-suave text-lg font-semibold">Con cariño, {regalo.d} ❤️</p>

        <section className="border-borde rounded-2xl border p-4 text-left">
          <h2 className="mb-2 text-lg font-extrabold">Tu regalo: ¡Hecho! ✅</h2>
          <ul className="flex flex-col gap-2 text-base">
            <li>✨ Cenas propuestas cada semana, pensadas para el menú del cole de las niñas</li>
            <li>🛒 La lista de la compra se hace sola</li>
            <li>🤝 Lo de casa, repartido entre los dos y a la vista</li>
          </ul>
        </section>

        <Link href="/" className="boton justify-self-center text-lg">
          Ver la aplicación
        </Link>
        <CintaAnimal otra className="-mx-4 -mb-4 sm:-mx-8 sm:-mb-8" />
      </article>
    </main>
  );
}

function Preparar() {
  const [r, setR] = useState<Regalo>(BORRADOR);
  const [aviso, setAviso] = useState("");
  const enlace = typeof window === "undefined" ? "" : enlaceDeRegalo(window.location.origin, r);
  const valido = r.p.trim() !== "" && r.d.trim() !== "" && r.m.length <= 600;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setAviso("Enlace copiado. Pégalo en un mensaje.");
    } catch {
      setAviso("No se ha podido copiar: selecciona el enlace y cópialo a mano.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 p-4 sm:p-8">
      <Link href="/" className="boton-suave w-fit">
        ← Volver
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight">
        Preparar el regalo <span aria-hidden="true">🎁</span>
      </h1>
      <p className="text-tinta-suave text-base">
        Escribe tu mensaje y copia el enlace. Quien lo abra verá una pantalla de felicitación y la
        aplicación. El mensaje va dentro del enlace: no se guarda en ningún servidor.
      </p>

      <div className="tarjeta flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-base font-semibold">
          Para
          <input
            className="campo"
            maxLength={40}
            value={r.p}
            onChange={(e) => setR({ ...r, p: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-base font-semibold">
          De
          <input
            className="campo"
            maxLength={40}
            value={r.d}
            onChange={(e) => setR({ ...r, d: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-base font-semibold">
          Mensaje (borrador: cámbialo por tus palabras)
          <textarea
            className="campo min-h-32 py-2"
            maxLength={600}
            value={r.m}
            onChange={(e) => setR({ ...r, m: e.target.value })}
          />
        </label>
      </div>

      <div className="tarjeta flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-base font-semibold">
          Enlace del regalo
          <input
            className="campo"
            readOnly
            value={valido ? enlace : ""}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" disabled={!valido} onClick={copiar}>
            Copiar enlace
          </button>
          {valido && (
            <a className="boton-suave" href={enlace} target="_blank" rel="noopener noreferrer">
              Ver cómo se verá
            </a>
          )}
        </div>
        {aviso && (
          <p role="status" className="text-ok-texto bg-ok-fondo rounded-2xl p-3 text-base">
            {aviso}
          </p>
        )}
      </div>
    </main>
  );
}
