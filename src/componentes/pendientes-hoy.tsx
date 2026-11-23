"use client";

import { type FormEvent, useState } from "react";
import { MAX_TEXTO_PENDIENTE, abiertos, textoEspera } from "@/dominio/pendientes";
import { useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";
import { SeccionHoy, Vacio } from "./seccion-hoy";

const MAX_EN_HOY = 6;

/**
 * Los pendientes sin fecha, siempre a mano en «Hoy» (D-180): se apunta uno escribiendo y pulsando
 * Intro, se marca con un toque y se ve de quién es y cuánto lleva esperando. Los seis más importantes
 * o antiguos; el resto, en Fechas → «Pendientes sin fecha».
 */
export function PendientesHoy() {
  const { estado, despachar } = useHogar();
  const guardar = useGuardar();
  const [texto, setTexto] = useState("");
  const [importante, setImportante] = useState(false);
  const [problema, setProblema] = useState("");
  const todos = abiertos(estado.pendientes);
  const vista = todos.slice(0, MAX_EN_HOY);

  function apuntar(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({
      tipo: "pendiente/anadir",
      texto,
      personaId: null,
      importante,
      idBase: crypto.randomUUID(),
    });
    setProblema(motivo ?? "");
    if (!motivo) {
      setTexto("");
      setImportante(false);
    }
  }

  return (
    <SeccionHoy
      id="sec-pendientes"
      plegable
      emoji="📝"
      titulo="Pendientes"
      cuenta={todos.length}
      urgente={todos.some((p) => p.importante)}
      enlace={{
        href: "/fechas#sin-fecha",
        texto: todos.length > MAX_EN_HOY ? `Ver los ${todos.length}` : "Gestionar",
      }}
    >
      <form onSubmit={apuntar} noValidate aria-label="Nuevo pendiente" className="flex gap-2">
        <input
          className="campo min-w-0 flex-1"
          aria-label="Nuevo pendiente"
          value={texto}
          maxLength={MAX_TEXTO_PENDIENTE}
          placeholder="＋ Apunta algo pendiente…"
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setTexto(e.target.value)}
        />
        <button
          type="button"
          className={importante ? "boton-icono border-2" : "boton-icono"}
          aria-pressed={importante}
          aria-label="Marcar como importante"
          title="Importante"
          onClick={() => setImportante((v) => !v)}
        >
          <span aria-hidden="true">⭐</span>
        </button>
        <button type="submit" className="boton" aria-label="Apuntar pendiente">
          ＋
        </button>
      </form>
      {problema && (
        <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          {problema}
        </p>
      )}
      {vista.length === 0 ? (
        <Vacio>Nada pendiente. Apunta aquí lo que se te ocurra 🎉</Vacio>
      ) : (
        <ul className="flex flex-col">
          {vista.map((p) => {
            const de = p.personaId
              ? estado.personas.find((x) => x.id === p.personaId)?.nombre
              : null;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked="false"
                  aria-label={`Hecho: ${p.texto}`}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-base"
                  onClick={() => despachar({ tipo: "pendiente/hecho", id: p.id, hecho: true })}
                >
                  <span aria-hidden="true">⬜</span>
                  <span>
                    {p.importante && <span aria-hidden="true">⭐ </span>}
                    {p.texto}
                    <span className="text-tinta-suave text-sm">
                      {" "}
                      · {textoEspera(p.creadoEn, estado.hoy)}
                      {de ? ` · ${de}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SeccionHoy>
  );
}
