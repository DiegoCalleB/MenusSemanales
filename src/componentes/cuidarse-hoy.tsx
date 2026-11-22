"use client";

import { type FormEvent, useState } from "react";
import {
  MAX_META_AGUA,
  MAX_NOMBRE_HABITO,
  animoDeAgua,
  cuidadoDe,
  diaDe,
  semanaDeEjercicio,
  semanasSeguidas,
  textoDeHabitos,
  tocaEjercicio,
} from "@/dominio/cuidado";
import { resumenDeDias } from "@/dominio/medicacion";
import { useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";
import { SeccionHoy } from "./seccion-hoy";
import { useYo } from "./yo";

const DIAS = [
  { n: 1, corto: "lun", largo: "lunes" },
  { n: 2, corto: "mar", largo: "martes" },
  { n: 3, corto: "mié", largo: "miércoles" },
  { n: 4, corto: "jue", largo: "jueves" },
  { n: 5, corto: "vie", largo: "viernes" },
  { n: 6, corto: "sáb", largo: "sábado" },
  { n: 7, corto: "dom", largo: "domingo" },
];

/**
 * «Cuidarse» (D-182): el agua y el ejercicio de quien tiene abierto el móvil, en
 * «Hoy». Un toque suma un vaso o marca lo hecho; se cuentan semanas, no se castiga un día fallado. Es
 * personal: cada perfil ve y ajusta lo suyo, y no sale de la app.
 */
export function CuidarseHoy() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  if (!yo) return null;

  const c = cuidadoDe(estado.cuidado, yo.id);
  const dia = diaDe(c, estado.hoy);
  const semana = semanaDeEjercicio(c, estado.hoy);
  const racha = semanasSeguidas(c, estado.hoy);
  const enCamino = Math.min(dia.agua, c.metaAgua);

  return (
    <SeccionHoy id="sec-cuidarse" emoji="💧" titulo="Cuidarse" plegable>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold">
          Agua: {dia.agua} de {c.metaAgua} vasos
        </p>
        <p aria-hidden="true" className="text-lg leading-tight tracking-wide">
          {"💧".repeat(enCamino)}
          {"⚪".repeat(c.metaAgua - enCamino)}
        </p>
        <p className="text-tinta-suave text-sm">{animoDeAgua(dia.agua, c.metaAgua)}</p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="boton"
            onClick={() =>
              despachar({ tipo: "cuidado/agua", personaId: yo.id, fecha: estado.hoy, delta: 1 })
            }
          >
            ＋ Vaso
          </button>
          <button
            type="button"
            className="boton-suave"
            disabled={dia.agua === 0}
            onClick={() =>
              despachar({ tipo: "cuidado/agua", personaId: yo.id, fecha: estado.hoy, delta: -1 })
            }
          >
            − Quitar
          </button>
        </div>
      </div>

      {c.ejercicio && (
        <div className="flex flex-col">
          {tocaEjercicio(c, estado.hoy) ? (
            <button
              type="button"
              aria-pressed={dia.ejercicio}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl text-left text-base ${dia.ejercicio ? "text-tinta-suave line-through" : ""}`}
              onClick={() =>
                despachar({ tipo: "cuidado/ejercicio", personaId: yo.id, fecha: estado.hoy })
              }
            >
              <span aria-hidden="true">{dia.ejercicio ? "✅" : "⬜"}</span>
              <span>Hoy toca: {c.ejercicio.nombre}</span>
            </button>
          ) : (
            <p className="text-base">
              <span aria-hidden="true">🏃 </span>Hoy descansas de {c.ejercicio.nombre}
            </p>
          )}
          <p className="text-tinta-suave text-sm">
            {semana.hechas} de {semana.objetivo} esta semana
            {racha > 1 ? ` · ${racha} semanas seguidas 🔥` : ""}
          </p>
        </div>
      )}

      <details>
        <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
          Ajustar mi meta de agua y mi ejercicio
        </summary>
        <AjustesDeCuidado key={`${yo.id}-${estado.cuidado.length}`} personaId={yo.id} />
      </details>
    </SeccionHoy>
  );
}

function AjustesDeCuidado({ personaId }: { personaId: string }) {
  const { estado } = useHogar();
  const guardar = useGuardar();
  const c = cuidadoDe(estado.cuidado, personaId);
  const [meta, setMeta] = useState(String(c.metaAgua));
  const [hace, setHace] = useState(c.ejercicio !== null);
  const [nombre, setNombre] = useState(c.ejercicio?.nombre ?? "");
  const [dias, setDias] = useState<number[]>(c.ejercicio?.dias ?? [1, 3, 5]);
  const [avisos, setAvisos] = useState(c.avisos);
  const [problema, setProblema] = useState("");
  const [guardado, setGuardado] = useState(false);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const motivo = guardar({
      tipo: "cuidado/ajustes",
      personaId,
      metaAgua: Number(meta),
      habitos: textoDeHabitos(c.habitos).split("\n"),
      ejercicio: hace ? { nombre, dias } : null,
      avisos,
    });
    setProblema(motivo ?? "");
    setGuardado(!motivo);
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-label="Ajustes de cuidarse"
      className="flex flex-col gap-3 pb-1"
    >
      <label className="flex flex-col gap-1 text-base font-semibold">
        Vasos de agua al día
        <input
          className="campo w-24"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_META_AGUA}
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
        />
      </label>

      <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={hace}
          onChange={(e) => setHace(e.target.checked)}
        />
        Quiero hacer ejercicio
      </label>
      {hace && (
        <>
          <label className="flex flex-col gap-1 text-base font-semibold">
            Qué ejercicio
            <input
              className="campo"
              value={nombre}
              maxLength={MAX_NOMBRE_HABITO}
              placeholder="Caminar, gimnasio, correr…"
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-base font-semibold">Qué días</legend>
            <div className="flex flex-wrap gap-1">
              {DIAS.map((d) => {
                const puesto = dias.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    aria-pressed={puesto}
                    aria-label={d.largo}
                    className={`${puesto ? "boton" : "boton-suave"} min-w-11`}
                    onClick={() =>
                      setDias((v) => (puesto ? v.filter((x) => x !== d.n) : [...v, d.n]))
                    }
                  >
                    {d.corto}
                  </button>
                );
              })}
            </div>
            <p className="text-tinta-suave text-sm">{resumenDeDias(dias)}</p>
          </fieldset>
        </>
      )}

      <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={avisos}
          onChange={(e) => setAvisos(e.target.checked)}
        />
        Avisarme en el móvil
      </label>
      <p className="text-tinta-suave -mt-2 text-sm">
        Agua a las 11 y a las 17 h si vas corto (con botón «+1 vaso»), el ejercicio a las 18 h si
        hoy toca y no lo has hecho (con botón «Hecho»), a mediodía lo que se repite en tus objetivos
        y, el domingo a las 19 h, la revisión de la semana. Hace falta tener activadas las
        notificaciones.
      </p>

      {problema && (
        <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          {problema}
        </p>
      )}
      {guardado && !problema && (
        <p role="status" className="text-tinta-suave text-sm">
          Guardado ✓
        </p>
      )}
      <button type="submit" className="boton w-fit">
        Guardar
      </button>
    </form>
  );
}
