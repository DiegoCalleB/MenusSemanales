"use client";

import { useId, useState } from "react";
import { type ArticuloIa, MAX_TEXTO_IA } from "@/dominio/ia-lista";
import { NOMBRE_CATEGORIA } from "@/dominio/habituales";
import { useCuenta, useHogar } from "./proveedor-hogar";

const MENSAJES: Record<string, string> = {
  "tope-diario": "Hoy ya habéis usado todas las consultas de IA. Mañana se renuevan.",
  "ia-no-configurada": "La IA todavía no está activada en esta instalación.",
  "sin-sesion": "Entra en tu cuenta (Más → Cuenta) para usar la IA.",
  "sin-hogar": "Primero crea o únete a un hogar (Más → Cuenta).",
  "peticion-invalida": "Escribe algo (hasta 1.500 letras).",
  "demasiado-grande": "Es demasiado texto: pégalo en partes.",
};

type Fase = "cerrado" | "escribiendo" | "pensando" | "revisando";

/**
 * «Ordenar con IA» (D-098): se escribe o se dicta todo a la carrera («lo de la paella, pañales
 * talla 4 y 2 yogures») y la IA lo convierte en artículos con cantidad y sección. La persona
 * revisa lo propuesto y elige qué añade: la IA nunca toca la lista por su cuenta.
 */
export function OrdenarConIa({ yaEnLista }: { yaEnLista: readonly string[] }) {
  const { despachar } = useHogar();
  const cuenta = useCuenta();
  const id = useId();
  const [fase, setFase] = useState<Fase>("cerrado");
  const [texto, setTexto] = useState("");
  const [propuestos, setPropuestos] = useState<ArticuloIa[]>([]);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [problema, setProblema] = useState("");
  const [restantes, setRestantes] = useState<number | null>(null);

  if (cuenta.fase !== "conectado") return null;

  async function ordenar() {
    setProblema("");
    setFase("pensando");
    try {
      const r = await fetch("/api/ia/lista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, yaEnLista: yaEnLista.slice(0, 150) }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as {
        articulos?: ArticuloIa[];
        error?: string;
        motivo?: string;
        usadas?: number | null;
        limite?: number | null;
      };
      if (!r.ok) {
        setProblema(
          MENSAJES[cuerpo.error ?? ""] ??
            `La IA no está disponible ahora. Inténtalo luego.${cuerpo.motivo ? ` (${cuerpo.motivo})` : ""}`,
        );
        setFase("escribiendo");
        return;
      }
      const lista = cuerpo.articulos ?? [];
      setPropuestos(lista);
      setElegidos(new Set(lista.map((_, i) => i)));
      setRestantes(
        typeof cuerpo.usadas === "number" && typeof cuerpo.limite === "number"
          ? cuerpo.limite - cuerpo.usadas
          : null,
      );
      setFase("revisando");
    } catch {
      setProblema("Sin conexión. Inténtalo de nuevo.");
      setFase("escribiendo");
    }
  }

  function anadir() {
    despachar({
      tipo: "manual/importar",
      articulos: propuestos.filter((_, i) => elegidos.has(i)),
    });
    cerrar();
  }

  function cerrar() {
    setFase("cerrado");
    setTexto("");
    setPropuestos([]);
    setProblema("");
  }

  if (fase === "cerrado") {
    return (
      <button type="button" className="boton-suave w-fit" onClick={() => setFase("escribiendo")}>
        <span aria-hidden="true">✨ </span>Ordenar con IA
      </button>
    );
  }

  return (
    <section aria-label="Ordenar con IA" className="tarjeta flex flex-col gap-2">
      {fase !== "revisando" && (
        <>
          <label htmlFor={`${id}-t`} className="text-base font-bold">
            Escribe o dicta lo que quieras
          </label>
          <textarea
            id={`${id}-t`}
            className="campo min-h-24"
            value={texto}
            maxLength={MAX_TEXTO_IA}
            placeholder="Lo de la paella, pañales talla 4, 2 yogures y lo que falte para el cumple…"
            onChange={(e) => setTexto(e.target.value)}
            disabled={fase === "pensando"}
          />
          {problema && (
            <p role="status" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-3 text-base">
              {problema}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="boton"
              disabled={fase === "pensando" || texto.trim() === ""}
              onClick={ordenar}
            >
              {fase === "pensando" ? "Pensando…" : "Ordenar"}
            </button>
            <button type="button" className="boton-suave" onClick={cerrar}>
              Cancelar
            </button>
          </div>
          <p className="text-tinta-suave text-xs">
            El texto se envía a una IA (Gemini, de Google) para ordenarlo. No se guarda. Nunca
            escribas aquí nada privado.
          </p>
        </>
      )}

      {fase === "revisando" && (
        <>
          <h2 className="text-base font-bold">
            {propuestos.length === 0
              ? "No he encontrado nada que apuntar."
              : `Esto he entendido (${propuestos.length}):`}
          </h2>
          <ul className="divide-borde divide-y">
            {propuestos.map((a, i) => (
              <li key={`${a.nombre}-${i}`}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1">
                  <input
                    type="checkbox"
                    className="size-6 accent-[var(--marca)]"
                    checked={elegidos.has(i)}
                    onChange={() =>
                      setElegidos((s) => {
                        const n = new Set(s);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base">{a.nombre}</span>
                    <span className="text-tinta-suave block truncate text-xs">
                      {NOMBRE_CATEGORIA[a.categoria].emoji} {NOMBRE_CATEGORIA[a.categoria].nombre}
                    </span>
                  </span>
                  {a.cantidad && (
                    <span className="text-tinta-suave shrink-0 text-sm tabular-nums">
                      {a.cantidad}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {propuestos.length > 0 && (
              <button
                type="button"
                className="boton"
                disabled={elegidos.size === 0}
                onClick={anadir}
              >
                Añadir {elegidos.size}
              </button>
            )}
            <button type="button" className="boton-suave" onClick={() => setFase("escribiendo")}>
              Volver a escribir
            </button>
            <button type="button" className="boton-suave" onClick={cerrar}>
              Cancelar
            </button>
          </div>
          {restantes !== null && (
            <p className="text-tinta-suave text-xs">
              Quedan {restantes} consultas de IA para hoy en vuestro hogar.
            </p>
          )}
        </>
      )}
    </section>
  );
}
