"use client";

import { type FormEvent, useState } from "react";
import { MAX_TEXTO_OBJETIVO, cuantoQueda, plazoLargo, porPlazo } from "@/dominio/objetivos";
import { Campo, Formulario, useGuardar } from "../editar";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

const EJEMPLO = `Hasta 31 diciembre 2026
Publicar más juegos
Viaje a Marruecos

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
              {g.objetivos.map((o) => {
                const hecho = o.hechoEn !== null;
                return (
                  <li key={o.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={hecho}
                      className={`flex min-h-11 flex-1 items-center gap-3 rounded-xl text-left text-base ${hecho ? "text-tinta-suave line-through" : ""}`}
                      onClick={() => despachar({ tipo: "objetivo/hecho", id: o.id, hecho: !hecho })}
                    >
                      <span aria-hidden="true">{hecho ? "✅" : "⬜"}</span>
                      <span>{o.texto}</span>
                    </button>
                    <button
                      type="button"
                      className="boton-icono"
                      aria-label={`Quitar «${o.texto}»`}
                      title="Quitar"
                      onClick={() => despachar({ tipo: "objetivo/borrar", id: o.id })}
                    >
                      <span aria-hidden="true">🗑️</span>
                    </button>
                  </li>
                );
              })}
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
  const [problema, setProblema] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({ tipo: "objetivo/anadir", personaId, texto, hasta });
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
          objetivos, uno por línea.
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
