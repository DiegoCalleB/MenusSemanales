"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { avisosDelEstado } from "@/aplicacion/avisos";
import { type Aviso, avisosQueImportan } from "@/dominio/avisos";
import { useHogar } from "./proveedor-hogar";

const CLAVE = "menus-semanales:avisos-vistos";

function vistosDe(hoy: string): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(CLAVE) ?? "null") as {
      hoy?: string;
      ids?: string[];
    } | null;
    return v?.hoy === hoy && Array.isArray(v.ids) ? v.ids : [];
  } catch {
    return [];
  }
}

/**
 * La campanita (D-114): los avisos de hoy dentro de la app —cumpleaños que se acercan, citas de
 * hoy y mañana, lo que toca en casa, la cena sin elegir—. El número es lo que aún no has visto.
 */
export function BotonAvisos() {
  const { estado } = useHogar();
  const [abierto, setAbierto] = useState(false);
  const [vistos, setVistos] = useState<string[]>([]);
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);

  const avisos = useMemo(() => avisosDelEstado(estado), [estado]);
  const importantes = useMemo(() => avisosQueImportan(avisos), [avisos]);
  const nuevos = importantes.filter((a) => !vistos.includes(a.id)).length;

  useEffect(() => {
    // Lo visto se lee del almacenamiento del móvil tras el primer pintado.
    void Promise.resolve().then(() => setVistos(vistosDe(estado.hoy)));
  }, [estado.hoy]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const alTocarFuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alTocarFuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alTocarFuera);
    };
  }, [abierto]);

  function alternar() {
    if (!abierto) {
      // Al abrir, todo lo que hay se da por visto: el número vuelve a cero.
      const ids = importantes.map((a) => a.id);
      setVistos(ids);
      try {
        window.localStorage.setItem(CLAVE, JSON.stringify({ hoy: estado.hoy, ids }));
      } catch {
        /* sin almacenamiento */
      }
    }
    setAbierto((v) => !v);
  }

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        className="boton-suave relative px-3"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={alternar}
      >
        <span aria-hidden="true">🔔</span>
        <span className="sr-only">
          Avisos{nuevos > 0 ? `: ${nuevos} ${nuevos === 1 ? "nuevo" : "nuevos"}` : ""}
        </span>
        {nuevos > 0 && (
          <span
            aria-hidden="true"
            className="bg-marca text-sobre-marca absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-xs font-bold"
          >
            {nuevos}
          </span>
        )}
      </button>
      {abierto && (
        <div
          id={id}
          role="dialog"
          aria-label="Avisos de hoy"
          className="border-borde bg-superficie fixed top-16 right-3 left-3 z-40 max-h-[70dvh] overflow-auto rounded-3xl border p-4 shadow-xl md:absolute md:top-12 md:right-0 md:left-auto md:w-96"
        >
          <h2 className="mb-2 text-lg font-extrabold">Avisos de hoy</h2>
          <ListaDeAvisos avisos={avisos} />
          <Link
            href="/compartir"
            onClick={() => setAbierto(false)}
            className="text-marca-fuerte mt-2 flex min-h-11 items-center text-base font-semibold"
          >
            📲 Recibir estos avisos en el móvil →
          </Link>
        </div>
      )}
    </div>
  );
}

function ListaDeAvisos({ avisos }: { avisos: readonly Aviso[] }) {
  if (avisos.length === 0) return <p className="text-tinta-suave text-base">Nada que avisar. 🎉</p>;
  return (
    <ul className="flex flex-col">
      {avisos.map((a) => (
        <li
          key={a.id}
          className="border-borde flex min-h-11 items-start gap-2 border-b py-2 last:border-b-0"
        >
          <span aria-hidden="true" className="text-xl">
            {a.emoji}
          </span>
          <span className={`min-w-0 text-base ${a.nivel === "ya" ? "font-bold" : ""}`}>
            {a.titulo}
            {a.detalle && (
              <span className="text-tinta-suave block text-sm font-normal">{a.detalle}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
