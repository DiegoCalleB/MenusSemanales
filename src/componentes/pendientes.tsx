"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  MAX_TEXTO_PENDIENTE,
  type Pendiente,
  abiertos,
  hechosRecientes,
  textoEspera,
} from "@/dominio/pendientes";
import { BotonEditar, Campo, Formulario, useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";

type Filtro = "todos" | "nadie" | string;

/**
 * Pendientes sin fecha (D-175), como una sección plegada de Fechas → Próximas (junto a las citas, y
 * sin llenarla): arriba, cuántos hay; al abrirla, apuntar uno, la lista y lo hecho. Se abre sola si se
 * llega con `#sin-fecha`.
 */
export function PendientesSeccion() {
  const { estado } = useHogar();
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#sin-fecha") void Promise.resolve().then(() => setAbierta(true));
  }, []);
  const n = abiertos(estado.pendientes).length;
  return (
    <section
      id="sin-fecha"
      aria-labelledby="sin-fecha-titulo"
      className="tarjeta flex flex-col gap-3"
    >
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls="sin-fecha-contenido"
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
        onClick={() => setAbierta((a) => !a)}
      >
        <span id="sin-fecha-titulo" className="text-xl font-extrabold">
          <span aria-hidden="true">📝 </span>Pendientes sin fecha
          <span className="text-tinta-suave text-base font-medium"> · {n}</span>
        </span>
        <span aria-hidden="true" className="text-xl">
          {abierta ? "▴" : "▾"}
        </span>
      </button>
      {abierta && (
        <div id="sin-fecha-contenido">
          <Pendientes />
        </div>
      )}
    </section>
  );
}

function Pendientes() {
  const { estado, despachar } = useHogar();
  const personas = estado.personas.filter((p) => p.activa);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const todos = abiertos(estado.pendientes);
  const lista = todos.filter((p) =>
    filtro === "todos" ? true : filtro === "nadie" ? p.personaId === null : p.personaId === filtro,
  );
  const hechos = hechosRecientes(estado.pendientes, estado.hoy);
  const hayAsignados = todos.some((p) => p.personaId !== null);

  return (
    <div className="flex flex-col gap-4">
      <NuevoPendiente />

      {hayAsignados && (
        <div role="group" aria-label="Filtrar pendientes" className="flex flex-wrap gap-2">
          {(
            [
              ["todos", "Todos"],
              ["nadie", "Sin asignar"],
              ...personas.map((p) => [p.id, p.nombre] as const),
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              className={filtro === id ? "boton" : "boton-suave"}
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      <section aria-labelledby="pendientes-lista" className="tarjeta flex flex-col gap-2">
        <h2 id="pendientes-lista" className="text-lg font-bold">
          Por hacer <span className="text-tinta-suave text-base font-medium">· {lista.length}</span>
        </h2>
        {lista.length === 0 ? (
          <p className="text-tinta-suave text-base">
            {todos.length === 0
              ? "Nada pendiente. Apunta lo que se te vaya ocurriendo."
              : "Nada con ese filtro."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((p) => (
              <Fila key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>

      {hechos.length > 0 && (
        <details className="tarjeta">
          <summary className="min-h-11 cursor-pointer text-base font-bold">
            Hechos ({hechos.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {hechos.map((p) => (
              <Fila key={p.id} p={p} />
            ))}
          </ul>
          <button
            type="button"
            className="boton-suave mt-2 w-fit"
            onClick={() => despachar({ tipo: "pendiente/limpiar" })}
          >
            Borrar los hechos
          </button>
        </details>
      )}
    </div>
  );
}

/** Apuntar de un tirón: escribir y pulsar Intro. La estrella y «de quién» son opcionales. */
export function NuevoPendiente({
  alTerminar,
  compacto = false,
}: {
  alTerminar?: () => void;
  compacto?: boolean;
}) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const personas = estado.personas.filter((p) => p.activa);
  const [texto, setTexto] = useState("");
  const [importante, setImportante] = useState(false);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [problema, setProblema] = useState("");

  function enviar(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({
      tipo: "pendiente/anadir",
      texto,
      personaId,
      importante,
      idBase: crypto.randomUUID(),
    });
    setProblema(motivo ?? "");
    if (!motivo) {
      setTexto("");
      setImportante(false);
      alTerminar?.();
    }
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Apuntar un pendiente"
      className={`flex flex-col gap-2 ${compacto ? "" : "border-borde bg-superficie rounded-2xl border p-3"}`}
    >
      <Campo texto="¿Qué hay que hacer?">
        <input
          className="campo"
          value={texto}
          maxLength={MAX_TEXTO_PENDIENTE}
          placeholder="Llamar al fontanero, arreglar la persiana…"
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={importante ? "boton" : "boton-suave"}
          aria-pressed={importante}
          onClick={() => setImportante((v) => !v)}
        >
          <span aria-hidden="true">⭐ </span>Importante
        </button>
        <span className="text-tinta-suave text-sm">Para:</span>
        <button
          type="button"
          className={personaId === null ? "boton" : "boton-suave"}
          aria-pressed={personaId === null}
          onClick={() => setPersonaId(null)}
        >
          Quien pueda
        </button>
        {personas.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === personaId ? "boton" : "boton-suave"}
            aria-pressed={p.id === personaId}
            onClick={() => setPersonaId(p.id)}
          >
            {p.nombre}
          </button>
        ))}
      </div>
      {problema && (
        <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          {problema}
        </p>
      )}
      <button type="submit" className="boton w-fit">
        ＋ Apuntar
      </button>
    </form>
  );
}

function Fila({ p }: { p: Pendiente }) {
  const { estado, despachar } = useHogar();
  const guardar = useGuardar();
  const [modo, setModo] = useState<"ver" | "editar" | "quitar">("ver");
  const de = p.personaId ? estado.personas.find((x) => x.id === p.personaId)?.nombre : null;
  const hecho = p.hechoEn !== null;

  if (modo === "editar") {
    return (
      <li>
        <EditarPendiente p={p} alCerrar={() => setModo("ver")} />
      </li>
    );
  }
  return (
    <li className="border-borde bg-fondo flex flex-col gap-1 rounded-2xl border py-1.5 pr-1.5 pl-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="boton-icono"
          role="checkbox"
          aria-checked={hecho}
          aria-label={`${hecho ? "Reabrir" : "Hecho"}: ${p.texto}`}
          title={hecho ? "Reabrir" : "Marcar como hecho"}
          onClick={() => despachar({ tipo: "pendiente/hecho", id: p.id, hecho: !hecho })}
        >
          <span aria-hidden="true">{hecho ? "✅" : "⬜"}</span>
        </button>
        <p className={`min-w-0 flex-1 text-base ${hecho ? "text-tinta-suave line-through" : ""}`}>
          {p.importante && !hecho && <span aria-hidden="true">⭐ </span>}
          <strong>{p.texto}</strong>
          <span className="text-tinta-suave block text-sm">
            {hecho ? "hecho" : textoEspera(p.creadoEn, estado.hoy)}
            {de ? ` · ${de}` : ""}
          </span>
        </p>
        {!hecho && (
          <span className="flex shrink-0 gap-1">
            <BotonEditar nombre={p.texto} alPulsar={() => setModo("editar")} />
            <button
              type="button"
              className="boton-icono"
              aria-label={`Quitar ${p.texto}`}
              title="Quitar"
              onClick={() => setModo("quitar")}
            >
              <span aria-hidden="true">🗑️</span>
            </button>
          </span>
        )}
      </div>
      {modo === "quitar" && (
        <div
          className="flex flex-wrap items-center gap-2 px-1 pb-1"
          role="group"
          aria-label={`¿Quitar ${p.texto}?`}
        >
          <span className="text-sm font-semibold">¿Quitarlo sin hacerlo?</span>
          <button
            type="button"
            className="boton"
            onClick={() => guardar({ tipo: "pendiente/borrar", id: p.id })}
          >
            Sí, quitar
          </button>
          <button type="button" className="boton-suave" onClick={() => setModo("ver")}>
            No
          </button>
        </div>
      )}
    </li>
  );
}

function EditarPendiente({ p, alCerrar }: { p: Pendiente; alCerrar: () => void }) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const personas = estado.personas.filter((x) => x.activa);
  const [texto, setTexto] = useState(p.texto);
  const [importante, setImportante] = useState(p.importante);
  const [personaId, setPersonaId] = useState<string | null>(p.personaId);
  return (
    <Formulario
      nombre={`Editar ${p.texto}`}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({ tipo: "pendiente/editar", id: p.id, texto, personaId, importante })
      }
    >
      <Campo texto="Qué hay que hacer">
        <input
          className="campo"
          value={texto}
          maxLength={MAX_TEXTO_PENDIENTE}
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={importante ? "boton" : "boton-suave"}
          aria-pressed={importante}
          onClick={() => setImportante((v) => !v)}
        >
          <span aria-hidden="true">⭐ </span>Importante
        </button>
        <button
          type="button"
          className={personaId === null ? "boton" : "boton-suave"}
          aria-pressed={personaId === null}
          onClick={() => setPersonaId(null)}
        >
          Quien pueda
        </button>
        {personas.map((x) => (
          <button
            key={x.id}
            type="button"
            className={x.id === personaId ? "boton" : "boton-suave"}
            aria-pressed={x.id === personaId}
            onClick={() => setPersonaId(x.id)}
          >
            {x.nombre}
          </button>
        ))}
      </div>
    </Formulario>
  );
}
