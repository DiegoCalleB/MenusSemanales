"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { Persona } from "@/dominio/tipos";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

const FONDOS = ["bg-suave-1", "bg-suave-2", "bg-suave-3", "bg-marca text-sobre-marca"] as const;

const sinSuscripcion = () => () => {};

/** Círculo con la inicial: el «avatar» del perfil. */
function Avatar({
  persona,
  indice,
  grande,
}: {
  persona: Persona;
  indice: number;
  grande?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${FONDOS[indice % FONDOS.length]} flex items-center justify-center rounded-full font-extrabold ${
        grande ? "size-24 text-5xl" : "size-8 text-base"
      }`}
    >
      {persona.nombre.charAt(0).toUpperCase()}
    </span>
  );
}

/** Adultos primero, luego los peques; solo quien está activo en el hogar. */
function perfiles(personas: readonly Persona[]): Persona[] {
  return personas
    .filter((p) => p.activa)
    .sort((a, b) => Number(a.tipo === "nino") - Number(b.tipo === "nino"));
}

/**
 * Pantalla de perfiles al estilo Netflix: cada persona entra en el suyo y la app la saluda, le
 * enseña sus tareas y le esconde las sorpresas. Se recuerda en este móvil (no se sincroniza). Hasta
 * que no se elige perfil no se enseña el resto, y hasta leer lo guardado no se decide nada, para
 * no parpadear ni ofrecer personas de ejemplo.
 */
export function PuertaDePerfil({ children }: { children: ReactNode }) {
  const { estado, cargado } = useHogar();
  const [yoId, fijarYo] = useYo();
  const montado = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  const gente = perfiles(estado.personas);

  if (!montado || !cargado) return <div className="min-h-dvh" />;
  if (gente.length === 0 || gente.some((p) => p.id === yoId)) return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">¿Quién eres?</h1>
      <ul className="flex flex-wrap justify-center gap-4">
        {gente.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => fijarYo(p.id)}
              className="hover:bg-suave-1 focus-visible:bg-suave-1 flex min-h-11 w-36 flex-col items-center gap-3 rounded-3xl p-3 text-lg font-bold"
            >
              <Avatar persona={p} indice={i} grande />
              {p.nombre}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-tinta-suave text-base">Solo se guarda en este móvil.</p>
    </main>
  );
}

/** Quién es ahora, y un toque para cambiar de perfil. */
export function BotonPerfil() {
  const { estado } = useHogar();
  const [yoId, fijarYo] = useYo();
  const gente = perfiles(estado.personas);
  const indice = gente.findIndex((p) => p.id === yoId);
  const yo = gente[indice];
  if (!yo) return null;
  return (
    <button type="button" className="boton-suave" onClick={() => fijarYo(null)}>
      <Avatar persona={yo} indice={indice} />
      <span className="sr-only min-[420px]:not-sr-only">{yo.nombre}</span>
      <span className="sr-only">. Cambiar de perfil</span>
    </button>
  );
}
