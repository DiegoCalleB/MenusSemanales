"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { elementosBuscables } from "@/aplicacion/buscar";
import { contextoParaPreguntar } from "@/aplicacion/preguntar";
import {
  MIN_LETRAS,
  TIPOS_DE_FECHAS,
  agruparPorTipo,
  buscar,
  normalizar,
} from "@/dominio/busqueda";
import { pareceUnaPregunta, preguntaValida } from "@/dominio/ia-preguntar";
import { useHogar } from "./proveedor-hogar";
import { usePlanesDelBarrio } from "./usar-barrio";

const DE_UNA_VEZ = 5;

/**
 * La caja de búsqueda (D-177). `todo` busca en todo el hogar; `fechas` solo en lo que tiene que ver
 * con fechas (citas, fechas señaladas, cumpleaños, papeles, pendientes y planes del barrio) y se
 * pone en Fechas. Los resultados salen al escribir, agrupados por tipo, y cada uno lleva a su sitio.
 */
export function Buscador({
  ambito,
  autoEnfocar = false,
}: {
  ambito: "todo" | "fechas";
  autoEnfocar?: boolean;
}) {
  const { estado } = useHogar();
  const barrio = usePlanesDelBarrio();
  const [texto, setTexto] = useState("");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const caja = useRef<HTMLInputElement>(null);
  // «Pregúntale a tu casa» (D-179): la respuesta de la IA a lo escrito en la caja.
  const [pensando, setPensando] = useState(false);
  const [respuesta, setRespuesta] = useState<{ pregunta: string; texto: string } | null>(null);
  const [fallo, setFallo] = useState("");

  useEffect(() => {
    // Desde la lupa de la cabecera se puede llegar con la búsqueda ya puesta (`?q=`).
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) void Promise.resolve().then(() => setTexto(q.slice(0, 80)));
    if (autoEnfocar) caja.current?.focus();
  }, [autoEnfocar]);

  const elementos = useMemo(() => elementosBuscables(estado, barrio), [estado, barrio]);
  const resultados = useMemo(
    () =>
      buscar(elementos, texto, {
        hoy: estado.hoy,
        ...(ambito === "fechas" ? { tipos: TIPOS_DE_FECHAS } : {}),
      }),
    [elementos, texto, ambito, estado.hoy],
  );
  const grupos = agruparPorTipo(resultados);

  async function preguntar() {
    const pregunta = texto.trim();
    if (!preguntaValida(pregunta) || pensando) return;
    setPensando(true);
    setFallo("");
    setRespuesta(null);
    try {
      const r = await fetch("/api/ia/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta, contexto: contextoParaPreguntar(estado, barrio) }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setFallo(
          r.status === 429
            ? "Hoy ya has usado todas las consultas con IA."
            : r.status === 401 || r.status === 403
              ? "Para preguntar a la IA hay que entrar con tu cuenta."
              : j.error === "ia-no-configurada"
                ? "La IA no está activada."
                : "No he podido contestar ahora. Prueba otra vez en un rato.",
        );
        return;
      }
      const j = (await r.json()) as { respuesta?: string };
      if (typeof j.respuesta === "string" && j.respuesta.trim() !== "") {
        setRespuesta({ pregunta, texto: j.respuesta.trim() });
      } else {
        setFallo("No he sabido contestar a eso. Prueba a preguntarlo de otra forma.");
      }
    } catch {
      setFallo("Parece que no hay conexión. Prueba otra vez en un rato.");
    } finally {
      setPensando(false);
    }
  }
  const buscando = normalizar(texto).length >= MIN_LETRAS;

  return (
    <section
      aria-label={ambito === "fechas" ? "Buscar en las fechas" : "Buscar"}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-base font-semibold">
        <span className={ambito === "fechas" ? "sr-only" : ""}>
          {ambito === "fechas" ? "Buscar en las fechas" : "¿Qué buscas?"}
        </span>
        <input
          ref={caja}
          type="search"
          className="campo"
          value={texto}
          maxLength={80}
          placeholder={
            ambito === "fechas"
              ? "🔍 Buscar una cita, un papel, un cumple…"
              : "Pediatra, ITV, lentejas, leche…"
          }
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            setTexto(e.target.value);
            setRespuesta(null);
            setFallo("");
          }}
        />
      </label>

      {ambito === "todo" && preguntaValida(texto) && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={pareceUnaPregunta(texto) ? "boton w-fit" : "boton-suave w-fit"}
            disabled={pensando}
            onClick={() => void preguntar()}
          >
            {pensando
              ? "Pensando…"
              : `✨ Preguntar a la IA: «${texto.trim().slice(0, 40)}${texto.trim().length > 40 ? "…" : ""}»`}
          </button>
          {fallo && (
            <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
              {fallo}
            </p>
          )}
          {respuesta && (
            <section
              aria-label="Respuesta"
              className="bg-suave-3 flex flex-col gap-1 rounded-2xl p-3"
            >
              <p className="text-base whitespace-pre-line">{respuesta.texto}</p>
              <p className="text-tinta-suave text-sm">
                Contesto solo con lo que hay apuntado en la app; puede equivocarse. La medicación no
                la veo.
              </p>
            </section>
          )}
        </div>
      )}

      {buscando && (
        <div aria-live="polite" className="flex flex-col gap-3">
          {grupos.length === 0 ? (
            <p className="tarjeta text-tinta-suave text-base">
              No he encontrado nada con «{texto.trim()}».
            </p>
          ) : (
            grupos.map(({ tipo, resultados: lista }) => {
              const todos = abiertos.has(tipo.id);
              const vistos = todos ? lista : lista.slice(0, DE_UNA_VEZ);
              return (
                <section
                  key={tipo.id}
                  aria-label={tipo.texto}
                  className="tarjeta flex flex-col gap-1"
                >
                  <h2 className="text-base font-bold">
                    <span aria-hidden="true">{tipo.emoji} </span>
                    {tipo.texto}
                    <span className="text-tinta-suave font-medium"> · {lista.length}</span>
                  </h2>
                  <ul className="flex flex-col">
                    {vistos.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={r.href}
                          className="hover:bg-fondo flex min-h-11 flex-col justify-center rounded-xl px-1 py-1"
                        >
                          <span className="text-base font-semibold">
                            <span aria-hidden="true">{r.emoji} </span>
                            {r.titulo}
                          </span>
                          {r.detalle && (
                            <span className="text-tinta-suave text-sm">{r.detalle}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {lista.length > DE_UNA_VEZ && !todos && (
                    <button
                      type="button"
                      className="boton-suave w-fit"
                      onClick={() => setAbiertos((s) => new Set(s).add(tipo.id))}
                    >
                      Ver los {lista.length}
                    </button>
                  )}
                </section>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
