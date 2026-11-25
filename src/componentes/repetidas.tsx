"use client";

import { useState } from "react";
import { proximaDe, textoRepeticion } from "@/dominio/repetidas";
import { Campo, Formulario, useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";

const fechaCorta = (f: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${f}T12:00:00Z`));

const CADA: ReadonlyArray<[number, string]> = [
  [7, "Cada semana"],
  [14, "Cada 2 semanas"],
  [21, "Cada 3 semanas"],
  [28, "Cada 4 semanas"],
];

/**
 * Fechas que se repiten (D-211): «Viene Yolanda» un miércoles sí y otro no, con un recordatorio el día
 * antes. Caen siempre el mismo día; si una vez no toca, se pospone una semana y sigue su ritmo.
 */
export function Repetidas() {
  const { estado, despachar } = useHogar();
  const [creando, setCreando] = useState(false);
  const guardar = useGuardar();

  return (
    <section aria-labelledby="se-repite" className="tarjeta flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="se-repite" className="text-xl font-extrabold">
          <span aria-hidden="true">🔁 </span>Se repite
        </h2>
        {!creando && (
          <button type="button" className="boton" onClick={() => setCreando(true)}>
            ＋ Algo que se repite
          </button>
        )}
      </div>
      {estado.repetidas.length === 0 && !creando && (
        <p className="text-tinta-suave text-base">
          Para lo que viene cada cierto tiempo, como quien viene a limpiar un miércoles sí y otro
          no, y lo que hay que preparar el día antes.
        </p>
      )}
      {creando && (
        <NuevaRepetida
          alCerrar={() => setCreando(false)}
          alGuardar={(d) => guardar({ tipo: "repetida/anadir", ...d })}
        />
      )}
      {estado.repetidas.length > 0 && (
        <ul aria-label="Fechas que se repiten" className="flex flex-col gap-2">
          {estado.repetidas.map((r) => {
            const proxima = proximaDe(r, estado.hoy);
            return (
              <li key={r.id} className="bg-fondo flex flex-col gap-2 rounded-2xl p-3">
                <p className="text-base">
                  <strong>{r.titulo}</strong>{" "}
                  <span className="text-tinta-suave">
                    · {textoRepeticion(r.cadaDias)}
                    {r.hora ? ` · ${r.hora}` : ""}
                  </span>
                </p>
                <p className="text-tinta-suave text-sm">
                  Próxima: <strong>{fechaCorta(proxima)}</strong>
                  {r.avisoAntes ? ` · el día antes: «${r.avisoAntes}»` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="boton-suave"
                    aria-label={`Posponer una semana: ${r.titulo}`}
                    onClick={() => despachar({ tipo: "repetida/posponer", id: r.id })}
                  >
                    ⏩ Posponer una semana
                  </button>
                  <button
                    type="button"
                    className="boton-icono"
                    aria-label={`Quitar «${r.titulo}»`}
                    title="Quitar"
                    onClick={() => despachar({ tipo: "repetida/borrar", id: r.id })}
                  >
                    <span aria-hidden="true">🗑️</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {estado.repetidas.length > 0 && (
        <p className="text-tinta-suave text-sm">
          Si una vez no toca, «Posponer una semana» la pasa a la semana siguiente y desde ahí vuelve
          a repetirse con su ritmo.
        </p>
      )}
    </section>
  );
}

function NuevaRepetida({
  alGuardar,
  alCerrar,
}: {
  alGuardar: (d: {
    titulo: string;
    hora: string | null;
    desde: string;
    cadaDias: number;
    avisoAntes: string | null;
  }) => string | null;
  alCerrar: () => void;
}) {
  const { estado } = useHogar();
  const [titulo, setTitulo] = useState("");
  const [desde, setDesde] = useState(estado.hoy);
  const [cada, setCada] = useState(14);
  const [hora, setHora] = useState("");
  const [antes, setAntes] = useState("");
  return (
    <Formulario
      nombre="Algo que se repite"
      alCerrar={alCerrar}
      alGuardar={() =>
        alGuardar({
          titulo,
          hora: hora || null,
          desde,
          cadaDias: cada,
          avisoAntes: antes.trim() || null,
        })
      }
    >
      <Campo texto="Qué es">
        <input
          className="campo"
          value={titulo}
          maxLength={80}
          placeholder="Viene Yolanda"
          onChange={(e) => setTitulo(e.target.value)}
        />
      </Campo>
      <Campo texto="La próxima vez es el">
        <input
          type="date"
          className="campo"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
      </Campo>
      <Campo texto="Se repite">
        <select className="campo" value={cada} onChange={(e) => setCada(Number(e.target.value))}>
          {CADA.map(([d, t]) => (
            <option key={d} value={d}>
              {t}
            </option>
          ))}
        </select>
      </Campo>
      <Campo texto="A qué hora (si la tiene)">
        <input
          type="time"
          className="campo"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
        />
      </Campo>
      <Campo texto="Recordar el día antes (opcional)">
        <input
          className="campo"
          value={antes}
          maxLength={80}
          placeholder="Dejar dinero para Yolanda"
          onChange={(e) => setAntes(e.target.value)}
        />
      </Campo>
    </Formulario>
  );
}
