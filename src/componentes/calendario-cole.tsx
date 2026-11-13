"use client";

import { useState } from "react";
import {
  CURSO_MADRID_2026_27,
  MAX_LARGO_MOTIVO,
  calendarioConocidoHasta,
  diaOficial,
  tramosSinCole,
} from "@/dominio/calendario-escolar";
import { fechaLarga } from "@/dominio/avisos";
import { sumarDias } from "@/dominio/fechas";
import { Campo, Formulario, useGuardar } from "./editar";
import { useHogar } from "./proveedor-hogar";

/** Cuántos días sin cole se enseñan por delante. */
const CUANTOS = 8;

/**
 * El calendario del cole (D-144): los próximos días sin cole (oficiales de Madrid y los que apunta
 * la familia), para apuntar los días de libre disposición del centro o decir «ese día sí hay cole».
 */
export function CalendarioCole() {
  const { estado, despachar } = useHogar();
  const [anadiendo, setAnadiendo] = useState(false);
  const hoy = estado.hoy;
  const proximos = tramosSinCole(estado.diasCole, hoy, 300).slice(0, CUANTOS);
  const siHay = estado.diasCole.filter((a) => a.hay && a.fecha >= hoy);
  const hasta = calendarioConocidoHasta();
  const faltaCurso = sumarDias(hoy, 60) > hasta;
  const rango = (desde: string, h: string) =>
    desde === h ? fechaLarga(desde) : `del ${fechaLarga(desde)} al ${fechaLarga(h)}`;

  return (
    <section aria-labelledby="calendario-cole" className="tarjeta flex flex-col gap-3">
      <h2 id="calendario-cole" className="text-lg font-bold">
        <span aria-hidden="true">🏫 </span>Días sin cole
      </h2>
      <p className="text-tinta-suave text-sm">
        {CURSO_MADRID_2026_27.nombre}. Lo del cole no se avisa de preparar si al día siguiente no
        hay clase. Añade los días que el cole tenga libres por su cuenta.
      </p>
      {faltaCurso && (
        <p role="status" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          El calendario que conozco llega hasta el {fechaLarga(hasta)}. Después aviso todos los días
          de lunes a viernes, hasta que esté el del curso siguiente.
        </p>
      )}
      <ul aria-label="Próximos días sin cole" className="flex flex-col gap-2">
        {proximos.length === 0 && (
          <li className="text-tinta-suave text-base">No hay días sin cole a la vista.</li>
        )}
        {proximos.map((t) => {
          const suelto = t.desde === t.hasta;
          return (
            <li
              key={t.desde}
              className="border-borde bg-fondo flex items-center justify-between gap-2 rounded-2xl border py-1.5 pr-1.5 pl-3"
            >
              <p className="min-w-0 text-base">
                <strong>{t.motivo}</strong>
                <span className="text-tinta-suave block text-sm">
                  {rango(t.desde, t.hasta)}
                  {t.origen === "familia" ? " · lo apuntasteis vosotros" : ""}
                </span>
              </p>
              {t.origen === "familia" ? (
                <button
                  type="button"
                  className="boton-icono"
                  aria-label={`Quitar ${t.motivo} del ${fechaLarga(t.desde)}`}
                  title="Quitar"
                  onClick={() => despachar({ tipo: "cole/oficial", fecha: t.desde })}
                >
                  <span aria-hidden="true">🗑️</span>
                </button>
              ) : (
                suelto && (
                  <button
                    type="button"
                    className="boton-suave shrink-0 text-sm"
                    onClick={() => despachar({ tipo: "cole/dia", fecha: t.desde, hay: true })}
                  >
                    Sí hay cole
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
      {siHay.length > 0 && (
        <ul aria-label="Días que sí hay cole" className="flex flex-col gap-2">
          {siHay.map((a) => (
            <li
              key={a.fecha}
              className="border-borde bg-fondo flex items-center justify-between gap-2 rounded-2xl border py-1.5 pr-1.5 pl-3"
            >
              <p className="min-w-0 text-base">
                <strong>Sí hay cole</strong>
                <span className="text-tinta-suave block text-sm">
                  {fechaLarga(a.fecha)} · en el calendario oficial: {diaOficial(a.fecha).motivo}
                </span>
              </p>
              <button
                type="button"
                className="boton-icono"
                aria-label={`Volver al calendario oficial el ${fechaLarga(a.fecha)}`}
                title="Volver al calendario oficial"
                onClick={() => despachar({ tipo: "cole/oficial", fecha: a.fecha })}
              >
                <span aria-hidden="true">↩️</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {anadiendo ? (
        <FormularioDiaSinCole alCerrar={() => setAnadiendo(false)} />
      ) : (
        <button type="button" className="boton-suave w-fit" onClick={() => setAnadiendo(true)}>
          ＋ Apuntar un día sin cole
        </button>
      )}
      <p className="text-tinta-suave text-xs">Fuente: {CURSO_MADRID_2026_27.fuente}.</p>
    </section>
  );
}

function FormularioDiaSinCole({ alCerrar }: { alCerrar: () => void }) {
  const guardar = useGuardar();
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("Día de libre disposición");
  const [hay, setHay] = useState(false);
  return (
    <Formulario
      nombre="Apuntar un día sin cole"
      alCerrar={alCerrar}
      alGuardar={() => guardar({ tipo: "cole/dia", fecha, hay, motivo })}
    >
      <Campo texto="Día">
        <input
          className="campo"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Campo>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-base font-semibold">Ese día</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={!hay ? "boton" : "boton-suave"}
            aria-pressed={!hay}
            onClick={() => setHay(false)}
          >
            No hay cole
          </button>
          <button
            type="button"
            className={hay ? "boton" : "boton-suave"}
            aria-pressed={hay}
            onClick={() => setHay(true)}
          >
            Sí hay cole
          </button>
        </div>
      </fieldset>
      {!hay && (
        <Campo texto="Por qué">
          <input
            className="campo"
            value={motivo}
            maxLength={MAX_LARGO_MOTIVO}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Campo>
      )}
    </Formulario>
  );
}
