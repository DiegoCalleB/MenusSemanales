"use client";

import { type FormEvent, useState } from "react";
import {
  MAX_TEXTO_NOTA,
  type Nota,
  type TipoNota,
  archivadas,
  bandeja,
  recuerdos,
} from "@/dominio/notas";
import { fechaLegible } from "@/aplicacion/buscar";
import { useGuardar } from "../editar";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

/**
 * Notas e ideas, y recuerdos (D-199). Apuntar algo suelto en un segundo; la bandeja se vacía en la
 * revisión de la semana. Los recuerdos son líneas con fecha, a veces sobre alguien. Es personal: no
 * sale de la app (no está en el buscador, ni en la IA, ni en el calendario, ni en los avisos).
 */
export function NotasVista() {
  const { estado } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Notas e ideas <span aria-hidden="true">💡</span>
        </h1>
        <p className="text-tinta-suave text-base">
          Apunta lo que se te ocurra sin pensar dónde va. Las ideas esperan en la bandeja hasta la
          revisión; los recuerdos se guardan con su fecha. Es solo tuyo: no sale de la app.
        </p>
      </header>
      {!yo ? (
        <p className="tarjeta text-base">
          Elige quién eres (en «Familia») para ver y apuntar tus notas.
        </p>
      ) : (
        <Notas personaId={yo.id} />
      )}
    </div>
  );
}

function Notas({ personaId }: { personaId: string }) {
  const { estado, despachar } = useHogar();
  const [filtro, setFiltro] = useState<string | null>(null);
  const pendientes = bandeja(estado.notas, personaId);
  const hechas = archivadas(estado.notas, personaId);
  const todosRecuerdos = recuerdos(estado.notas, personaId);
  const lista = recuerdos(estado.notas, personaId, filtro);
  const nombre = (id: string | null) => estado.personas.find((p) => p.id === id)?.nombre ?? null;
  const sobreQuien = [
    ...new Set(todosRecuerdos.map((n) => n.sobre).filter((x): x is string => !!x)),
  ];

  return (
    <>
      <NuevaNota personaId={personaId} />

      <section aria-labelledby="bandeja" className="tarjeta flex flex-col gap-2">
        <h2 id="bandeja" className="text-lg font-extrabold">
          <span aria-hidden="true">📥 </span>Bandeja
          <span className="text-tinta-suave text-base font-medium"> · {pendientes.length}</span>
        </h2>
        {pendientes.length === 0 ? (
          <p className="text-tinta-suave text-base">Bandeja vacía. 🎉</p>
        ) : (
          <ul aria-label="Ideas en la bandeja" className="flex flex-col gap-2">
            {pendientes.map((n) => (
              <li
                key={n.id}
                className="border-borde flex flex-col gap-1 border-b pb-2 last:border-b-0"
              >
                <p className="text-base whitespace-pre-line">{n.texto}</p>
                <p className="text-tinta-suave text-sm">{fechaLegible(n.creadoEn)}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="boton"
                    aria-label={`Pasar a pendiente: ${n.texto}`}
                    onClick={() => despachar({ tipo: "nota/a-pendiente", id: n.id })}
                  >
                    → Pendiente
                  </button>
                  <button
                    type="button"
                    className="boton-suave"
                    aria-label={`Archivar: ${n.texto}`}
                    onClick={() => despachar({ tipo: "nota/archivar", id: n.id, archivada: true })}
                  >
                    Archivar
                  </button>
                  <Borrar n={n} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recuerdos" className="tarjeta flex flex-col gap-2">
        <h2 id="recuerdos" className="text-lg font-extrabold">
          <span aria-hidden="true">💛 </span>Recuerdos
          <span className="text-tinta-suave text-base font-medium"> · {todosRecuerdos.length}</span>
        </h2>
        {sobreQuien.length > 0 && (
          <div role="group" aria-label="Filtrar recuerdos" className="flex flex-wrap gap-2">
            {[null, ...sobreQuien].map((id) => (
              <button
                key={id ?? "todos"}
                type="button"
                aria-pressed={filtro === id}
                className={filtro === id ? "boton" : "boton-suave"}
                onClick={() => setFiltro(id)}
              >
                {id === null ? "Todos" : (nombre(id) ?? "—")}
              </button>
            ))}
          </div>
        )}
        {lista.length === 0 ? (
          <p className="text-tinta-suave text-base">
            Aún no hay recuerdos. Una línea sobre lo que hicieron o dijeron hoy basta.
          </p>
        ) : (
          <ul aria-label="Recuerdos" className="flex flex-col gap-2">
            {lista.map((n) => (
              <li
                key={n.id}
                className="border-borde flex items-start gap-1 border-b pb-2 last:border-b-0"
              >
                <div className="flex-1">
                  <p className="text-base whitespace-pre-line">{n.texto}</p>
                  <p className="text-tinta-suave text-sm">
                    {fechaLegible(n.creadoEn)}
                    {nombre(n.sobre) ? ` · sobre ${nombre(n.sobre)}` : ""}
                  </p>
                </div>
                <Borrar n={n} icono />
              </li>
            ))}
          </ul>
        )}
      </section>

      {hechas.length > 0 && (
        <details className="tarjeta">
          <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
            Ideas archivadas · {hechas.length}
          </summary>
          <ul aria-label="Ideas archivadas" className="flex flex-col gap-2 pt-2">
            {hechas.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2">
                <span className="text-tinta-suave flex-1 text-base">{n.texto}</span>
                <button
                  type="button"
                  className="boton-suave"
                  aria-label={`Volver a la bandeja: ${n.texto}`}
                  onClick={() => despachar({ tipo: "nota/archivar", id: n.id, archivada: false })}
                >
                  Volver
                </button>
                <Borrar n={n} icono />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Borrar({ n, icono = false }: { n: Nota; icono?: boolean }) {
  const { despachar } = useHogar();
  return (
    <button
      type="button"
      className={icono ? "boton-icono" : "boton-suave"}
      aria-label={`Borrar: ${n.texto}`}
      title="Borrar"
      onClick={() => despachar({ tipo: "nota/borrar", id: n.id })}
    >
      <span aria-hidden="true">🗑️</span>
      {!icono && " Borrar"}
    </button>
  );
}

function NuevaNota({ personaId }: { personaId: string }) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoNota>("idea");
  const [sobre, setSobre] = useState("");
  const [problema, setProblema] = useState("");

  function enviar(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({
      tipo: "nota/anadir",
      personaId,
      nota: tipo,
      texto,
      sobre: tipo === "recuerdo" && sobre ? sobre : null,
    });
    setProblema(motivo ?? "");
    if (!motivo) setTexto("");
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Apuntar una nota"
      className="tarjeta flex flex-col gap-2"
    >
      <textarea
        className="campo min-h-24"
        aria-label="Nota"
        value={texto}
        maxLength={MAX_TEXTO_NOTA}
        placeholder={
          tipo === "idea"
            ? "Una idea, algo que no quiero olvidar…"
            : "Lo que han hecho o dicho hoy…"
        }
        onChange={(e) => setTexto(e.target.value)}
      />
      <div role="group" aria-label="Qué es" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={tipo === "idea"}
          className={tipo === "idea" ? "boton" : "boton-suave"}
          onClick={() => setTipo("idea")}
        >
          💡 Idea
        </button>
        <button
          type="button"
          aria-pressed={tipo === "recuerdo"}
          className={tipo === "recuerdo" ? "boton" : "boton-suave"}
          onClick={() => setTipo("recuerdo")}
        >
          💛 Recuerdo
        </button>
      </div>
      {tipo === "recuerdo" && (
        <label className="flex flex-col gap-1 text-base font-semibold">
          Sobre quién
          <select className="campo" value={sobre} onChange={(e) => setSobre(e.target.value)}>
            <option value="">Nadie en concreto</option>
            {estado.personas
              .filter((p) => p.activa)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>
        </label>
      )}
      {problema && (
        <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          {problema}
        </p>
      )}
      <button type="submit" className="boton w-fit">
        Apuntar
      </button>
    </form>
  );
}
