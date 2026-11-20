"use client";

import { type FormEvent, useState } from "react";
import {
  DIAS_PARADO,
  MAX_TEXTO_OBJETIVO,
  type Objetivo,
  cuantoQueda,
  diasSinMoverse,
  haceCuanto,
  plazoLargo,
  porPlazo,
  textoCada,
} from "@/dominio/objetivos";
import { Campo, Formulario, useGuardar } from "../editar";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

const EJEMPLO = `Hasta 31 diciembre 2026
Publicar más juegos
Plan a solas con cada hija (cada semana)

Hasta marzo 2027
Dar a conocer mi proyecto`;

/**
 * Objetivos a plazos (D-195): lo que quien tiene el móvil quiere conseguir «hasta el 31 de
 * diciembre», «hasta marzo»… Es personal y no sale de la app: no está en el buscador, ni en la IA, ni
 * en el calendario, ni en los avisos.
 */
export function ObjetivosVista() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Objetivos <span aria-hidden="true">🎯</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Lo que quieres conseguir, por plazos. Es solo tuyo: no sale de la app.
        </p>
      </header>

      {!yo ? (
        <p className="tarjeta text-base">
          Elige quién eres (en «Familia») para ver y apuntar tus objetivos.
        </p>
      ) : (
        <Objetivos personaId={yo.id} despachar={despachar} />
      )}
    </div>
  );
}

function Objetivos({
  personaId,
  despachar,
}: {
  personaId: string;
  despachar: ReturnType<typeof useHogar>["despachar"];
}) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const grupos = porPlazo(estado.objetivos, personaId);
  const [nuevoPlazo, setNuevoPlazo] = useState(false);

  return (
    <>
      {grupos.length === 0 && !nuevoPlazo && (
        <p className="tarjeta text-base">
          Aún no hay nada. Apunta un plazo («hasta el 31 de diciembre») y lo que quieres conseguir
          en él, o pega tu lista de golpe.
        </p>
      )}

      {grupos.map((g) => {
        const titulo = `Hasta el ${plazoLargo(g.hasta)}`;
        return (
          <section key={g.hasta} aria-label={titulo} className="tarjeta flex flex-col gap-2">
            <div className="flex flex-col">
              <h2 className="text-lg font-extrabold">{titulo}</h2>
              <p className="text-tinta-suave text-sm">
                {cuantoQueda(g.hasta, estado.hoy)} · {g.hechos} de {g.objetivos.length} conseguidos
              </p>
            </div>
            <ul aria-label={`Objetivos ${titulo}`} className="flex flex-col">
              {g.objetivos.map((o) => (
                <FilaObjetivo key={o.id} o={o} hoy={estado.hoy} despachar={despachar} />
              ))}
            </ul>
            <AnadirA hasta={g.hasta} titulo={titulo} personaId={personaId} />
          </section>
        );
      })}

      {nuevoPlazo ? (
        <NuevoPlazo
          alCerrar={() => setNuevoPlazo(false)}
          alGuardar={(hasta, texto) =>
            guardar({ tipo: "objetivo/anadir", personaId, texto, hasta })
          }
        />
      ) : (
        <button type="button" className="boton w-fit" onClick={() => setNuevoPlazo(true)}>
          + Nuevo plazo
        </button>
      )}

      <PegarLista personaId={personaId} />
    </>
  );
}

const OPCIONES_CADA: ReadonlyArray<[string, string]> = [
  ["", "No se repite"],
  ["7", "Cada semana"],
  ["14", "Cada 2 semanas"],
  ["30", "Cada mes"],
];

function FilaObjetivo({
  o,
  hoy,
  despachar,
}: {
  o: Objetivo;
  hoy: string;
  despachar: ReturnType<typeof useHogar>["despachar"];
}) {
  const guardar = useGuardar();
  const [editando, setEditando] = useState(false);
  const [paso, setPaso] = useState(o.siguiente ?? "");
  const [problema, setProblema] = useState("");
  const hecho = o.hechoEn !== null;
  const dias = diasSinMoverse(o, hoy);
  const repite = o.cada !== null;
  const toca = repite && !hecho && dias >= (o.cada ?? 0);
  const parado = !repite && !hecho && dias >= DIAS_PARADO;

  function enviarPaso(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({ tipo: "objetivo/paso", id: o.id, texto: paso });
    setProblema(motivo ?? "");
    if (!motivo) setEditando(false);
  }

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-1">
        {repite ? (
          <span className="flex min-h-11 flex-1 items-center gap-3 text-base">
            <span aria-hidden="true">🔁</span>
            <span>
              {o.texto}
              <span
                className={`block text-sm ${toca ? "text-aviso-texto font-semibold" : "text-tinta-suave"}`}
              >
                {textoCada(o.cada ?? 0)} ·{" "}
                {o.movidoEn
                  ? `última vez ${haceCuanto(dias)}`
                  : toca
                    ? `sin hacer ${haceCuanto(dias)}`
                    : "aún no toca"}
              </span>
            </span>
          </span>
        ) : (
          <button
            type="button"
            aria-pressed={hecho}
            className={`flex min-h-11 flex-1 items-center gap-3 rounded-xl text-left text-base ${hecho ? "text-tinta-suave line-through" : ""}`}
            onClick={() => despachar({ tipo: "objetivo/hecho", id: o.id, hecho: !hecho })}
          >
            <span aria-hidden="true">{hecho ? "✅" : "⬜"}</span>
            <span>
              {o.texto}
              {parado && (
                <span className="text-aviso-texto block text-sm font-semibold">
                  Sin moverse {haceCuanto(dias)}
                </span>
              )}
            </span>
          </button>
        )}
        {repite && !hecho && (
          <button
            type="button"
            className="boton-suave"
            aria-label={`Hecho hoy: ${o.texto}`}
            onClick={() => despachar({ tipo: "objetivo/movido", id: o.id })}
          >
            Hecho hoy
          </button>
        )}
        <button
          type="button"
          className="boton-icono"
          aria-label={`Quitar «${o.texto}»`}
          title="Quitar"
          onClick={() => despachar({ tipo: "objetivo/borrar", id: o.id })}
        >
          <span aria-hidden="true">🗑️</span>
        </button>
      </div>
      {!hecho && !repite && !editando && (
        <div className="flex flex-wrap items-center gap-2 pb-1 pl-9">
          {o.siguiente ? (
            <>
              <span className="text-tinta-suave text-sm">
                <span aria-hidden="true">→ </span>
                {o.siguiente}
              </span>
              <button
                type="button"
                className="boton-suave"
                aria-label={`Paso hecho: ${o.siguiente}`}
                onClick={() => {
                  despachar({ tipo: "objetivo/movido", id: o.id });
                  setPaso("");
                  setEditando(true);
                }}
              >
                ✓ Paso hecho
              </button>
              <button
                type="button"
                className="text-marca-fuerte min-h-11 px-1 text-sm font-semibold underline"
                aria-label={`Cambiar el paso de «${o.texto}»`}
                onClick={() => {
                  setPaso(o.siguiente ?? "");
                  setEditando(true);
                }}
              >
                Cambiar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-marca-fuerte min-h-11 px-1 text-sm font-semibold underline"
              aria-label={`Siguiente paso de «${o.texto}»`}
              onClick={() => setEditando(true)}
            >
              ＋ Siguiente paso
            </button>
          )}
        </div>
      )}
      {editando && (
        <form
          onSubmit={enviarPaso}
          noValidate
          aria-label={`Siguiente paso de ${o.texto}`}
          className="flex flex-col gap-2 pb-2 pl-9"
        >
          <div className="flex gap-2">
            <input
              className="campo min-w-0 flex-1"
              aria-label={`Escribe el siguiente paso de «${o.texto}»`}
              value={paso}
              maxLength={MAX_TEXTO_OBJETIVO}
              placeholder="La próxima cosa concreta que harás"
              onChange={(e) => setPaso(e.target.value)}
            />
            <button type="submit" className="boton-suave">
              Guardar
            </button>
            <button
              type="button"
              className="boton-suave"
              onClick={() => {
                setEditando(false);
                setProblema("");
              }}
            >
              Ahora no
            </button>
          </div>
          {problema && (
            <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
              {problema}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

function AnadirA({
  hasta,
  titulo,
  personaId,
}: {
  hasta: string;
  titulo: string;
  personaId: string;
}) {
  const guardar = useGuardar();
  const [texto, setTexto] = useState("");
  const [cada, setCada] = useState("");
  const [problema, setProblema] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({
      tipo: "objetivo/anadir",
      personaId,
      texto,
      hasta,
      cada: cada ? Number(cada) : null,
    });
    setProblema(motivo ?? "");
    if (!motivo) setTexto("");
  }
  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label={`Añadir a ${titulo}`}
      className="flex flex-col gap-2"
    >
      <div className="flex gap-2">
        <input
          className="campo min-w-0 flex-1"
          aria-label={`Nuevo objetivo ${titulo}`}
          value={texto}
          maxLength={MAX_TEXTO_OBJETIVO}
          placeholder="Otro objetivo para este plazo"
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="boton-suave">
          Añadir
        </button>
      </div>
      <select
        className="campo w-fit"
        aria-label={`Se repite ${titulo}`}
        value={cada}
        onChange={(e) => setCada(e.target.value)}
      >
        {OPCIONES_CADA.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
      {problema && (
        <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          {problema}
        </p>
      )}
    </form>
  );
}

function NuevoPlazo({
  alGuardar,
  alCerrar,
}: {
  alGuardar: (hasta: string, texto: string) => string | null;
  alCerrar: () => void;
}) {
  const { estado } = useHogar();
  const [hasta, setHasta] = useState(`${estado.hoy.slice(0, 4)}-12-31`);
  const [texto, setTexto] = useState("");
  return (
    <Formulario nombre="Nuevo plazo" alGuardar={() => alGuardar(hasta, texto)} alCerrar={alCerrar}>
      <Campo texto="Hasta qué día">
        <input
          type="date"
          className="campo"
          value={hasta}
          min={estado.hoy}
          onChange={(e) => setHasta(e.target.value)}
        />
      </Campo>
      <Campo texto="Primer objetivo">
        <input
          className="campo"
          value={texto}
          maxLength={MAX_TEXTO_OBJETIVO}
          placeholder="Publicar más juegos"
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
    </Formulario>
  );
}

function PegarLista({ personaId }: { personaId: string }) {
  const guardar = useGuardar();
  const [texto, setTexto] = useState("");
  const [problema, setProblema] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({ tipo: "objetivo/importar", personaId, texto });
    setProblema(motivo ?? "");
    if (!motivo) setTexto("");
  }
  return (
    <details className="tarjeta">
      <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
        Pegar una lista de golpe
      </summary>
      <form
        onSubmit={enviar}
        noValidate
        aria-label="Pegar una lista"
        className="flex flex-col gap-2 pt-2"
      >
        <p className="text-tinta-suave text-sm">
          Una línea con el plazo («Hasta 31 diciembre 2026», «Hasta marzo 2027») y debajo sus
          objetivos, uno por línea. Si algo se repite, añade «(cada semana)», «(cada 2 semanas)» o
          «(cada mes)» al final.
        </p>
        <textarea
          className="campo min-h-40"
          aria-label="Lista de objetivos"
          value={texto}
          maxLength={6000}
          placeholder={EJEMPLO}
          onChange={(e) => setTexto(e.target.value)}
        />
        {problema && (
          <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
            {problema}
          </p>
        )}
        <button type="submit" className="boton w-fit">
          Apuntar la lista
        </button>
      </form>
    </details>
  );
}
