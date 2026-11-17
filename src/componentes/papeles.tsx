"use client";

import { useState } from "react";
import {
  CATEGORIAS,
  type CategoriaVencimiento,
  MARGENES,
  MAX_NOTAS_VENCIMIENTO,
  MAX_TITULO_VENCIMIENTO,
  PLANTILLAS,
  type Plantilla,
  type Vencimiento,
  agrupar,
  diasHasta,
  emojiDe,
  estadoDe,
  fechaAlRenovar,
  textoCuando,
  textoRepite,
} from "@/dominio/vencimientos";
import { BotonEditar, Campo, Formulario, useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";

const fechaLarga = (f: string) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${f}T12:00:00Z`));

const REPETICIONES: ReadonlyArray<[number | null, string]> = [
  [null, "No se repite"],
  [6, "Cada 6 meses"],
  [12, "Cada año"],
  [24, "Cada 2 años"],
  [48, "Cada 4 años"],
  [60, "Cada 5 años"],
  [120, "Cada 10 años"],
];

const TEXTO_MARGEN = (d: number) =>
  d === 0
    ? "El mismo día"
    : d === 1
      ? "1 día antes"
      : d >= 30
        ? `${d / 30} mes${d >= 60 ? "es" : ""} antes`
        : `${d} días antes`;

/** Papeles y vencimientos (D-174): la lista por urgencia, apuntar nuevos y renovar. */
export function Papeles() {
  const { estado } = useHogar();
  const [anadiendo, setAnadiendo] = useState(estado.vencimientos.length === 0);
  const g = agrupar(estado.vencimientos, estado.hoy);
  const hayAlgo = estado.vencimientos.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {hayAlgo && (
        <p className="text-tinta-suave text-base" role="status">
          {g.vencidos.length > 0 && (
            <strong className="text-peligro-texto">
              {g.vencidos.length} vencido{g.vencidos.length === 1 ? "" : "s"} ·{" "}
            </strong>
          )}
          {g.proximos.length} en los próximos 30 días · {g.despues.length} más adelante
        </p>
      )}

      {anadiendo ? (
        <NuevoPapel alCerrar={() => setAnadiendo(false)} />
      ) : (
        <button type="button" className="boton w-fit" onClick={() => setAnadiendo(true)}>
          ＋ Apuntar un papel
        </button>
      )}

      {!hayAlgo && !anadiendo && (
        <p className="tarjeta text-tinta-suave text-base">
          Aún no hay nada. Empieza por lo que más se olvida: la ITV, el seguro del coche o el
          pasaporte.
        </p>
      )}

      <Grupo titulo="Vencidos" emoji="⚠️" lista={g.vencidos} />
      <Grupo titulo="Próximos 30 días" lista={g.proximos} />
      <Grupo titulo="Más adelante" lista={g.despues} />
      {g.hechos.length > 0 && (
        <details className="tarjeta">
          <summary className="min-h-11 cursor-pointer text-base font-bold">
            Hechos ({g.hechos.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {g.hechos.map((v) => (
              <Fila key={v.id} v={v} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Grupo({ titulo, emoji, lista }: { titulo: string; emoji?: string; lista: Vencimiento[] }) {
  if (lista.length === 0) return null;
  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">
        {emoji && <span aria-hidden="true">{emoji} </span>}
        {titulo}
      </h2>
      <ul className="flex flex-col gap-2">
        {lista.map((v) => (
          <Fila key={v.id} v={v} />
        ))}
      </ul>
    </section>
  );
}

function Fila({ v }: { v: Vencimiento }) {
  const { estado, despachar } = useHogar();
  const guardar = useGuardar();
  const [modo, setModo] = useState<"ver" | "editar" | "renovar" | "quitar">("ver");
  const dias = diasHasta(v, estado.hoy);
  const e = estadoDe(v, estado.hoy);
  const de = v.personaId ? estado.personas.find((p) => p.id === v.personaId)?.nombre : null;
  const hecho = v.hechoEn !== null;

  if (modo === "editar") {
    return (
      <li>
        <FormularioPapel vencimiento={v} alCerrar={() => setModo("ver")} />
      </li>
    );
  }
  if (modo === "renovar") {
    return (
      <li>
        <FormularioRenovar v={v} alCerrar={() => setModo("ver")} />
      </li>
    );
  }

  const color = hecho
    ? "bg-fondo border-borde"
    : e === "vencido"
      ? "bg-peligro-fondo text-peligro-texto border-transparent"
      : e === "urgente"
        ? "bg-aviso-fondo text-aviso-texto border-transparent"
        : "bg-fondo border-borde";

  return (
    <li className={`flex flex-col gap-2 rounded-2xl border p-3 ${color}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-bold">
            <span aria-hidden="true">{emojiDe(v.categoria)} </span>
            {v.titulo}
            {de && <span className="font-medium"> · {de}</span>}
          </p>
          <p className="text-sm">
            {hecho
              ? `Hecho el ${fechaLarga(v.hechoEn!)}`
              : `${textoCuando(dias)} · ${fechaLarga(v.fecha)}`}
          </p>
          <p className="text-sm opacity-80">
            {textoRepite(v.repiteMeses)}
            {v.renovado.length > 0 &&
              ` · renovado ${v.renovado.length} ${v.renovado.length === 1 ? "vez" : "veces"}`}
          </p>
          {v.notas && <p className="text-sm whitespace-pre-line">{v.notas}</p>}
        </div>
        <span className="flex shrink-0 gap-1">
          <BotonEditar nombre={v.titulo} alPulsar={() => setModo("editar")} />
          <button
            type="button"
            className="boton-icono"
            aria-label={`Quitar ${v.titulo}`}
            title="Quitar"
            onClick={() => setModo("quitar")}
          >
            <span aria-hidden="true">🗑️</span>
          </button>
        </span>
      </div>
      {modo === "quitar" ? (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={`¿Quitar ${v.titulo}?`}
        >
          <span className="text-sm font-semibold">¿Quitarlo del todo?</span>
          <button
            type="button"
            className="boton"
            onClick={() => despachar({ tipo: "vencimiento/borrar", id: v.id })}
          >
            Sí, quitar
          </button>
          <button type="button" className="boton-suave" onClick={() => setModo("ver")}>
            No
          </button>
        </div>
      ) : hecho ? (
        <button
          type="button"
          className="boton-suave w-fit"
          onClick={() => guardar({ tipo: "vencimiento/hecho", id: v.id, hecho: false })}
        >
          Reabrir
        </button>
      ) : v.repiteMeses !== null ? (
        <button
          type="button"
          className="boton w-fit"
          aria-label={`Renovado: ${v.titulo}`}
          onClick={() => setModo("renovar")}
        >
          ✓ Renovado
        </button>
      ) : (
        <button
          type="button"
          className="boton w-fit"
          aria-label={`Hecho: ${v.titulo}`}
          onClick={() => guardar({ tipo: "vencimiento/hecho", id: v.id, hecho: true })}
        >
          ✓ Hecho
        </button>
      )}
    </li>
  );
}

/** Al renovar, se elige la nueva fecha de vencimiento (con la siguiente que toca ya puesta). */
function FormularioRenovar({ v, alCerrar }: { v: Vencimiento; alCerrar: () => void }) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const [fecha, setFecha] = useState(fechaAlRenovar(v, estado.hoy) ?? "");
  return (
    <Formulario
      nombre={`Renovar ${v.titulo}`}
      alCerrar={alCerrar}
      alGuardar={() => guardar({ tipo: "vencimiento/renovar", id: v.id, fecha })}
    >
      <p className="text-base font-bold">
        <span aria-hidden="true">{emojiDe(v.categoria)} </span>
        {v.titulo}
      </p>
      <Campo texto="¿Cuándo vence ahora?">
        <input
          className="campo"
          type="date"
          value={fecha}
          min={v.fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Campo>
      <p className="text-tinta-suave text-sm">
        Antes vencía el {fechaLarga(v.fecha)}. Pon la fecha nueva que figura en el documento o el
        recibo.
      </p>
    </Formulario>
  );
}

/** Apuntar uno nuevo: primero se elige de la lista de los habituales (o «Otro»). */
function NuevoPapel({ alCerrar }: { alCerrar: () => void }) {
  const [plantilla, setPlantilla] = useState<Plantilla | "otro" | null>(null);
  if (plantilla !== null) {
    return (
      <FormularioPapel
        plantilla={plantilla === "otro" ? undefined : plantilla}
        alCerrar={alCerrar}
        alVolver={() => setPlantilla(null)}
      />
    );
  }
  return (
    <section aria-labelledby="papel-elige" className="tarjeta flex flex-col gap-3">
      <h2 id="papel-elige" className="text-lg font-bold">
        ¿Qué quieres apuntar?
      </h2>
      <ul className="grid grid-cols-2 gap-2">
        {PLANTILLAS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="boton-suave h-full min-h-11 w-full justify-start text-left"
              onClick={() => setPlantilla(p)}
            >
              <span aria-hidden="true">{p.emoji} </span>
              {p.titulo}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="boton-suave h-full min-h-11 w-full justify-start text-left"
            onClick={() => setPlantilla("otro")}
          >
            <span aria-hidden="true">📄 </span>Otro…
          </button>
        </li>
      </ul>
      <button type="button" className="boton-suave w-fit" onClick={alCerrar}>
        Cancelar
      </button>
    </section>
  );
}

/** Añadir (con una plantilla o en blanco) o editar (con `vencimiento`). */
function FormularioPapel({
  vencimiento,
  plantilla,
  alCerrar,
  alVolver,
}: {
  vencimiento?: Vencimiento;
  plantilla?: Plantilla;
  alCerrar: () => void;
  alVolver?: () => void;
}) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const personas = estado.personas.filter((p) => p.activa);
  const [titulo, setTitulo] = useState(vencimiento?.titulo ?? plantilla?.titulo ?? "");
  const [categoria, setCategoria] = useState<CategoriaVencimiento>(
    vencimiento?.categoria ?? plantilla?.categoria ?? "otro",
  );
  const [personaId, setPersonaId] = useState<string | null>(vencimiento?.personaId ?? null);
  const [fecha, setFecha] = useState(vencimiento?.fecha ?? "");
  const [repite, setRepite] = useState<number | null>(
    vencimiento ? vencimiento.repiteMeses : (plantilla?.repiteMeses ?? null),
  );
  const [avisos, setAvisos] = useState<number[]>(
    vencimiento?.avisos ?? plantilla?.avisos ?? [30, 7, 1],
  );
  const [notas, setNotas] = useState(vencimiento?.notas ?? "");

  const opcionesRepite = REPETICIONES.some(([m]) => m === repite)
    ? REPETICIONES
    : [
        ...REPETICIONES,
        [repite, textoRepite(repite).replace(/^./, (c) => c.toUpperCase())] as const,
      ];
  const alternar = (d: number) =>
    setAvisos((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]));

  return (
    <Formulario
      nombre={vencimiento ? `Editar ${vencimiento.titulo}` : "Apuntar un papel"}
      alCerrar={alCerrar}
      alGuardar={() =>
        guardar({
          tipo: "vencimiento/guardar",
          ...(vencimiento ? { id: vencimiento.id } : { idBase: crypto.randomUUID() }),
          titulo,
          categoria,
          personaId,
          fecha,
          repiteMeses: repite,
          avisos,
          notas,
        })
      }
    >
      {plantilla && <p className="text-tinta-suave text-sm">{plantilla.pista}</p>}
      <Campo texto="Qué es">
        <input
          className="campo"
          value={titulo}
          maxLength={MAX_TITULO_VENCIMIENTO}
          placeholder="ITV del coche, pasaporte de Alba…"
          onChange={(e) => setTitulo(e.target.value)}
        />
      </Campo>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.id === categoria ? "boton" : "boton-suave"}
              aria-pressed={c.id === categoria}
              onClick={() => setCategoria(c.id)}
            >
              <span aria-hidden="true">{c.emoji} </span>
              {c.texto}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">De quién es</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={personaId === null ? "boton" : "boton-suave"}
            aria-pressed={personaId === null}
            onClick={() => setPersonaId(null)}
          >
            Toda la familia
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
      </fieldset>
      <Campo texto="Cuándo vence">
        <input
          className="campo"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Campo>
      <Campo texto="Se repite">
        <select
          className="campo"
          value={repite === null ? "" : String(repite)}
          onChange={(e) => setRepite(e.target.value === "" ? null : Number(e.target.value))}
        >
          {opcionesRepite.map(([m, t]) => (
            <option key={m ?? "no"} value={m === null ? "" : String(m)}>
              {t}
            </option>
          ))}
        </select>
      </Campo>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">Avisarme</legend>
        <div className="flex flex-wrap gap-2">
          {MARGENES.map((d) => (
            <button
              key={d}
              type="button"
              className={avisos.includes(d) ? "boton" : "boton-suave"}
              aria-pressed={avisos.includes(d)}
              onClick={() => alternar(d)}
            >
              {TEXTO_MARGEN(d)}
            </button>
          ))}
        </div>
      </fieldset>
      <Campo texto="Notas (opcional)">
        <textarea
          className="campo min-h-20 py-2"
          value={notas}
          maxLength={MAX_NOTAS_VENCIMIENTO}
          placeholder="Con qué compañía, dónde se pide cita…"
          onChange={(e) => setNotas(e.target.value)}
        />
      </Campo>
      <p className="text-tinta-suave text-sm">
        No apuntes números de documento ni contraseñas: solo el nombre y la fecha.
      </p>
      {alVolver && (
        <button type="button" className="boton-suave w-fit" onClick={alVolver}>
          ← Elegir otro
        </button>
      )}
    </Formulario>
  );
}
