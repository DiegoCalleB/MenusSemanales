"use client";

import { useState } from "react";
import { type Medicamento, horaTexto, resumenDeDias } from "@/dominio/medicacion";
import { NOMBRE_DIA_CORTO } from "@/dominio/mochila";
import { BotonEditar, Campo, Formulario, useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";

const LUNES_A_VIERNES = [1, 2, 3, 4, 5];
const TODOS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Medicación (D-166): los medicamentos de cada persona, con su hora y sus días («la pastilla, a las
 * 21:00, de lunes a viernes»). Se configuran aquí y la app avisa a esa hora, en el móvil de esa
 * persona. Se marca como tomada en «Hoy».
 */
export function Medicacion() {
  const { estado, despachar } = useHogar();
  const [anadiendo, setAnadiendo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const personas = estado.personas.filter((p) => p.activa);

  return (
    <section aria-labelledby="medicacion" className="tarjeta flex flex-col gap-3">
      <h2 id="medicacion" className="text-lg font-bold">
        <span aria-hidden="true">💊 </span>Medicación
      </h2>
      <p className="text-tinta-suave text-base">
        Te aviso a la hora que elijas, en el móvil de quien lo toma. Ponle el nombre que quieras:
        «Pastilla» basta.
      </p>
      {estado.medicacion.length === 0 && !anadiendo && (
        <p className="text-tinta-suave text-base">
          Aún no hay nada. Por ejemplo: «Pastilla», a las 21:00, de lunes a viernes.
        </p>
      )}
      {personas.map((p) => {
        const suyas = estado.medicacion.filter((m) => m.personaId === p.id);
        if (suyas.length === 0) return null;
        return (
          <div key={p.id} className="flex flex-col gap-2">
            <h3 className="text-base font-extrabold">{p.nombre}</h3>
            <ul aria-label={`Medicación de ${p.nombre}`} className="flex flex-col gap-2">
              {suyas.map((m) =>
                editando === m.id ? (
                  <li key={m.id}>
                    <FormularioMedicamento medicamento={m} alCerrar={() => setEditando(null)} />
                  </li>
                ) : (
                  <li
                    key={m.id}
                    className="border-borde bg-fondo flex items-center justify-between gap-2 rounded-2xl border py-1.5 pr-1.5 pl-3"
                  >
                    <p className="min-w-0 text-base">
                      <strong>{m.nombre}</strong>
                      <span className="text-tinta-suave block text-sm">
                        {horaTexto(m.hora)} · {resumenDeDias(m.dias)}
                      </span>
                    </p>
                    <span className="flex shrink-0 gap-1">
                      <BotonEditar nombre={m.nombre} alPulsar={() => setEditando(m.id)} />
                      <button
                        type="button"
                        className="boton-icono"
                        aria-label={`Quitar ${m.nombre} de ${p.nombre}`}
                        title="Quitar"
                        onClick={() => despachar({ tipo: "medicacion/borrar", id: m.id })}
                      >
                        <span aria-hidden="true">🗑️</span>
                      </button>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </div>
        );
      })}
      {anadiendo ? (
        <FormularioMedicamento alCerrar={() => setAnadiendo(false)} />
      ) : (
        <button type="button" className="boton w-fit" onClick={() => setAnadiendo(true)}>
          ＋ Apuntar un medicamento
        </button>
      )}
    </section>
  );
}

/** Añadir (sin `medicamento`) o cambiar un medicamento. */
function FormularioMedicamento({
  medicamento,
  alCerrar,
}: {
  medicamento?: Medicamento;
  alCerrar: () => void;
}) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const personas = estado.personas.filter((p) => p.activa);
  // Los medicamentos suelen ser de adultos: por defecto, el primero.
  const [personaId, setPersonaId] = useState(
    medicamento?.personaId ??
      personas.find((p) => p.tipo === "adulto")?.id ??
      personas[0]?.id ??
      "",
  );
  const [nombre, setNombre] = useState(medicamento?.nombre ?? "");
  const [hora, setHora] = useState(medicamento?.hora ?? 21);
  const [dias, setDias] = useState<number[]>(medicamento?.dias ?? LUNES_A_VIERNES);
  const alternarDia = (d: number) =>
    setDias((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]));

  return (
    <Formulario
      nombre={medicamento ? `Editar ${medicamento.nombre}` : "Apuntar un medicamento"}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({
          tipo: "medicacion/guardar",
          ...(medicamento ? { id: medicamento.id } : {}),
          personaId,
          nombre,
          hora,
          dias,
        })
      }
    >
      <Campo texto="Cómo lo llamas">
        <input
          className="campo"
          value={nombre}
          maxLength={60}
          placeholder="Pastilla"
          onChange={(e) => setNombre(e.target.value)}
        />
      </Campo>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">Quién lo toma</legend>
        <div className="flex flex-wrap gap-2">
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
      </fieldset>
      <Campo texto="A qué hora te aviso">
        <select className="campo" value={hora} onChange={(e) => setHora(Number(e.target.value))}>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {horaTexto(h)}
            </option>
          ))}
        </select>
      </Campo>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">Qué días</legend>
        <div role="group" aria-label="Días de la semana" className="flex flex-wrap gap-1">
          {NOMBRE_DIA_CORTO.map((n, i) => (
            <button
              key={n}
              type="button"
              className={dias.includes(i + 1) ? "boton px-3" : "boton-suave px-3"}
              aria-pressed={dias.includes(i + 1)}
              onClick={() => alternarDia(i + 1)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" className="boton-suave" onClick={() => setDias(LUNES_A_VIERNES)}>
            De lunes a viernes
          </button>
          <button type="button" className="boton-suave" onClick={() => setDias(TODOS)}>
            Todos los días
          </button>
        </div>
      </fieldset>
    </Formulario>
  );
}
