"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";
import type { Accion } from "@/aplicacion/estado";
import { reducir } from "@/aplicacion/estado";
import type { Almuerzo } from "@/dominio/almuerzos";
import type { Apunte } from "@/dominio/agenda";
import type { TareaCasa } from "@/dominio/casa";
import type { Cumple, Relacion } from "@/dominio/cumples";
import type { Premio } from "@/dominio/premios";
import type { FrecuenciaTarea, Tarea } from "@/dominio/tareas";
import { existePlato } from "./plato-nuevo";
import { useHogar } from "./proveedor-hogar";

/**
 * Editar lo que se puede añadir (D-133): citas, cumpleaños, tareas de la casa, tareas de cada
 * persona y la comida del mediodía. Cada formulario se abre en el sitio, con lo que ya hay, y
 * aplica las mismas reglas que al crearlo: si algo no vale, se queda abierto y dice por qué.
 */

/**
 * Prueba la acción sobre el estado actual: si el reductor la rechaza, devuelve el motivo y no
 * cambia nada; si vale, la despacha. Así el formulario no se cierra cuando algo está mal.
 */
function useGuardar() {
  const { estado, despachar } = useHogar();
  return (accion: Accion): string | null => {
    const prueba = reducir(estado, accion);
    if (prueba.aviso?.tipo === "error") return prueba.aviso.texto;
    despachar(accion);
    return null;
  };
}

function Campo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-base font-semibold">
      {texto}
      {children}
    </label>
  );
}

function Formulario({
  nombre,
  alGuardar,
  alCerrar,
  children,
}: {
  nombre: string;
  /** Devuelve null si se guardó o el motivo por el que no vale. */
  alGuardar: () => string | null;
  alCerrar: () => void;
  children: ReactNode;
}) {
  const [problema, setProblema] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    const motivo = alGuardar();
    if (motivo) setProblema(motivo);
    else alCerrar();
  }
  return (
    <form
      onSubmit={enviar}
      // La validación que cuenta es la nuestra (en español y diciendo qué falla), no la del navegador.
      noValidate
      aria-label={nombre}
      className="border-borde bg-superficie flex flex-col gap-3 rounded-2xl border p-3"
    >
      {children}
      {problema && (
        <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          {problema}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="boton">
          Guardar
        </button>
        <button type="button" className="boton-suave" onClick={alCerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** El botón que abre la edición, con el mismo aspecto en todas las pantallas. */
export function BotonEditar({ nombre, alPulsar }: { nombre: string; alPulsar: () => void }) {
  return (
    <button
      type="button"
      className="boton-icono"
      aria-label={`Editar ${nombre}`}
      title="Editar"
      onClick={alPulsar}
    >
      <span aria-hidden="true">✏️</span>
    </button>
  );
}

/* ───────────── Citas y fechas apuntadas ───────────── */

export function EditarCita({ cita, alCerrar }: { cita: Apunte; alCerrar: () => void }) {
  const guardar = useGuardar();
  const [titulo, setTitulo] = useState(cita.titulo);
  const [fecha, setFecha] = useState(cita.fecha);
  const [hasta, setHasta] = useState(cita.hasta ?? "");
  const [hora, setHora] = useState(cita.hora ?? "");
  return (
    <Formulario
      nombre={`Editar ${cita.titulo}`}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({
          tipo: "agenda/editar",
          id: cita.id,
          titulo,
          fecha,
          hasta: hasta === "" ? null : hasta,
          hora: hora === "" ? null : hora,
        })
      }
    >
      <Campo texto="Qué es">
        <input
          className="campo"
          value={titulo}
          maxLength={120}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </Campo>
      <Campo texto="Día">
        <input
          className="campo"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Campo>
      <Campo texto="Hasta el día (si dura varios)">
        <input
          className="campo"
          type="date"
          value={hasta}
          min={fecha}
          onChange={(e) => setHasta(e.target.value)}
        />
      </Campo>
      <Campo texto="Hora (si la tiene)">
        <input
          className="campo"
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
        />
      </Campo>
    </Formulario>
  );
}

/* ───────────── Cumpleaños ───────────── */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const RELACIONES: ReadonlyArray<{ id: Relacion; texto: string }> = [
  { id: "familia", texto: "Familia" },
  { id: "amigo", texto: "Amigo o amiga" },
  { id: "cole", texto: "Cole" },
  { id: "otro", texto: "Otro" },
];

export function EditarCumple({ cumple, alCerrar }: { cumple: Cumple; alCerrar: () => void }) {
  const guardar = useGuardar();
  const [nombre, setNombre] = useState(cumple.nombre);
  const [dia, setDia] = useState(String(cumple.dia));
  const [mes, setMes] = useState(String(cumple.mes));
  const [anio, setAnio] = useState(cumple.anio ? String(cumple.anio) : "");
  const [relacion, setRelacion] = useState<Relacion>(cumple.relacion);
  return (
    <Formulario
      nombre={`Editar el cumpleaños de ${cumple.nombre}`}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({
          tipo: "cumple/editar",
          id: cumple.id,
          nombre,
          dia: Number(dia),
          mes: Number(mes),
          anio: anio.trim() === "" ? null : Number(anio),
          relacion,
        })
      }
    >
      <Campo texto="Nombre">
        <input
          className="campo"
          value={nombre}
          maxLength={60}
          onChange={(e) => setNombre(e.target.value)}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo texto="Día">
          <input
            className="campo"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          />
        </Campo>
        <Campo texto="Mes">
          <select className="campo" value={mes} onChange={(e) => setMes(e.target.value)}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo texto="Año de nacimiento (si lo sabes)">
        <input
          className="campo"
          type="number"
          inputMode="numeric"
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
          placeholder="Opcional"
        />
      </Campo>
      <Campo texto="Quién es">
        <select
          className="campo"
          value={relacion}
          onChange={(e) => setRelacion(e.target.value as Relacion)}
        >
          {RELACIONES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.texto}
            </option>
          ))}
        </select>
      </Campo>
    </Formulario>
  );
}

/* ───────────── Tareas de la casa ───────────── */

export function EditarTareaCasa({ tarea, alCerrar }: { tarea: TareaCasa; alCerrar: () => void }) {
  const guardar = useGuardar();
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [cada, setCada] = useState(String(tarea.cadaDias));
  const [emoji, setEmoji] = useState(tarea.emoji);
  return (
    <Formulario
      nombre={`Editar ${tarea.titulo}`}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({
          tipo: "casa/editar",
          id: tarea.id,
          titulo,
          cadaDias: Number(cada),
          emoji,
        })
      }
    >
      <Campo texto="Qué hay que hacer">
        <input
          className="campo"
          value={titulo}
          maxLength={80}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </Campo>
      <Campo texto="Cada cuántos días">
        <input
          className="campo"
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          value={cada}
          onChange={(e) => setCada(e.target.value)}
        />
      </Campo>
      <Campo texto="Dibujo">
        <input
          className="campo"
          value={emoji}
          maxLength={8}
          onChange={(e) => setEmoji(e.target.value)}
        />
      </Campo>
    </Formulario>
  );
}

/* ───────────── Tareas de una persona ───────────── */

export function EditarTarea({ tarea, alCerrar }: { tarea: Tarea; alCerrar: () => void }) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const [texto, setTexto] = useState(tarea.texto);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaTarea>(tarea.frecuencia);
  const [personaId, setPersonaId] = useState(tarea.personaId);
  const personas = estado.personas.filter((p) => p.activa || p.id === tarea.personaId);
  return (
    <Formulario
      nombre={`Editar la tarea ${tarea.texto}`}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({ tipo: "tarea/editar", id: tarea.id, texto, frecuencia, personaId })
      }
    >
      <Campo texto="La tarea">
        <input
          className="campo"
          value={texto}
          maxLength={80}
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
      <Campo texto="Cada cuánto">
        <select
          className="campo"
          value={frecuencia}
          onChange={(e) => setFrecuencia(e.target.value as FrecuenciaTarea)}
        >
          <option value="diaria">Cada día</option>
          <option value="puntual">Una vez</option>
        </select>
      </Campo>
      <Campo texto="A quién le toca">
        <select className="campo" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </Campo>
    </Formulario>
  );
}

/* ───────────── Comida del mediodía ───────────── */

export function EditarComida({ comida, alCerrar }: { comida: Almuerzo; alCerrar: () => void }) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const id = useId();
  const [texto, setTexto] = useState(comida.texto);
  const [fecha, setFecha] = useState(comida.fecha);
  return (
    <Formulario
      nombre={`Editar la comida ${comida.texto}`}
      alCerrar={alCerrar}
      alGuardar={() => {
        // Si lo escrito es un plato de la casa, se apunta como tal (cuenta para la compra y la cena).
        const plato = estado.platos.find((p) => existePlato([p.nombre], texto));
        return guardar({
          tipo: "almuerzo/editar",
          id: comida.id,
          fecha,
          ...(plato ? { platoId: plato.id } : { texto }),
        });
      }}
    >
      <Campo texto="Qué se come">
        <input
          className="campo"
          list={`${id}-platos`}
          value={texto}
          maxLength={80}
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
      <datalist id={`${id}-platos`}>
        {estado.platos.map((p) => (
          <option key={p.id} value={p.nombre} />
        ))}
      </datalist>
      <Campo texto="Día">
        <input
          className="campo"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Campo>
    </Formulario>
  );
}

/* ───────────── Premios ───────────── */

export function EditarPremio({ premio, alCerrar }: { premio: Premio; alCerrar: () => void }) {
  const guardar = useGuardar();
  const [nombre, setNombre] = useState(premio.nombre);
  const [coste, setCoste] = useState(String(premio.coste));
  const [emoji, setEmoji] = useState(premio.emoji);
  return (
    <Formulario
      nombre={`Editar el premio ${premio.nombre}`}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({ tipo: "premio/guardar", id: premio.id, nombre, coste: Number(coste), emoji })
      }
    >
      <Campo texto="Premio">
        <input
          className="campo"
          value={nombre}
          maxLength={60}
          onChange={(e) => setNombre(e.target.value)}
        />
      </Campo>
      <Campo texto="Cuántas estrellas cuesta">
        <input
          className="campo"
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          value={coste}
          onChange={(e) => setCoste(e.target.value)}
        />
      </Campo>
      <Campo texto="Dibujo">
        <input
          className="campo"
          value={emoji}
          maxLength={8}
          onChange={(e) => setEmoji(e.target.value)}
        />
      </Campo>
    </Formulario>
  );
}
