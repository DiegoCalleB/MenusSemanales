"use client";

import { useEffect, useState } from "react";
import type { EstadoHogar } from "@/aplicacion/estado";
import {
  type Respaldo,
  crearRespaldo,
  leerRespaldo,
  leerRespaldosAutomaticos,
  nombreDeArchivo,
  textoDeRespaldo,
} from "@/infraestructura/respaldo";
import { useCuenta, useHogar } from "./proveedor-hogar";
import { EVENTO_RESPALDOS } from "./usar-nube";

const almacenamiento = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

function descargar(r: Respaldo) {
  const url = URL.createObjectURL(new Blob([textoDeRespaldo(r)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreDeArchivo(r);
  a.click();
  URL.revokeObjectURL(url);
}

const resumen = (e: EstadoHogar) =>
  `${e.personas.length} personas · ${e.cumples.length} cumples · ${e.agenda.length} apuntes · ${e.casa.length} tareas de casa · ${e.tareas.length} tareas por persona`;

const cuando = (iso: string) =>
  iso
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso),
      )
    : "fecha desconocida";

/**
 * Copias de seguridad (fase 0, D-086): lo que hay en este móvil se puede descargar a un archivo y
 * volver a poner. Además, antes de que la nube sustituya lo de un móvil, la app guarda sola una
 * copia (aquí se descarga). Restaurar solo se permite sin cuenta: con la nube conectada,
 * sobrescribiría lo de toda la familia.
 */
export function PanelRespaldo() {
  const { estado, despachar } = useHogar();
  const { fase } = useCuenta();
  const conectado = fase === "conectado";
  const [automaticas, setAutomaticas] = useState<Respaldo[]>([]);
  const [candidato, setCandidato] = useState<Respaldo | null>(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const leer = () => setAutomaticas(leerRespaldosAutomaticos(almacenamiento()));
    leer();
    window.addEventListener(EVENTO_RESPALDOS, leer);
    return () => window.removeEventListener(EVENTO_RESPALDOS, leer);
  }, []);

  async function alElegirArchivo(archivo: File | undefined) {
    setCandidato(null);
    if (!archivo) return;
    const lectura = leerRespaldo(await archivo.text());
    if (!lectura.ok) {
      setMensaje(lectura.motivo);
      return;
    }
    setMensaje("");
    setCandidato(lectura.respaldo);
  }

  function restaurar() {
    if (!candidato) return;
    despachar({ tipo: "hogar/sustituir", estado: { ...candidato.estado, hoy: estado.hoy } });
    setCandidato(null);
    setMensaje("Copia restaurada en este móvil.");
  }

  return (
    <section aria-labelledby="respaldo" className="tarjeta flex flex-col gap-3">
      <h2 id="respaldo" className="text-lg font-extrabold">
        💾 Copia de seguridad
      </h2>
      <p className="text-base">
        Lo que hay en este móvil ({resumen(estado)}). Descárgala y guárdala: es tu seguro si se
        borran los datos del navegador o cambias de móvil.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="boton"
          onClick={() => {
            descargar(crearRespaldo(estado, new Date()));
            setMensaje(
              "Copia descargada. Guárdala en un sitio seguro (correo, Drive, tu ordenador).",
            );
          }}
        >
          Descargar copia de este móvil
        </button>
        <label
          className={`boton-suave ${conectado ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
        >
          Restaurar desde un archivo
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            disabled={conectado}
            onChange={(e) => {
              void alElegirArchivo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {conectado && (
        <p className="text-tinta-suave text-sm">
          Restaurar está bloqueado mientras estás en la nube: sobrescribiría lo de toda la familia.
          Para restaurar, primero sal de la cuenta.
        </p>
      )}

      {candidato && (
        <div role="alert" className="bg-suave-1 flex flex-col gap-2 rounded-2xl p-3">
          <p className="text-base font-bold">Copia del {cuando(candidato.creado)}</p>
          <p className="text-base">{resumen(candidato.estado)}</p>
          <p className="text-base">
            Se <strong>sustituye todo lo de este móvil</strong> por esta copia. Hazte antes una
            copia de lo actual si no estás seguro.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton" onClick={restaurar}>
              Sí, sustituir lo de este móvil
            </button>
            <button type="button" className="boton-suave" onClick={() => setCandidato(null)}>
              No
            </button>
          </div>
        </div>
      )}

      {automaticas.length > 0 && (
        <>
          <h3 className="text-base font-extrabold">Copias automáticas de este móvil</h3>
          <p className="text-tinta-suave text-sm">
            La app las guardó sola justo antes de sustituir lo de este móvil por lo de la nube.
          </p>
          <ul aria-label="Copias automáticas" className="flex flex-col gap-2">
            {automaticas.map((r) => (
              <li
                key={r.creado}
                className="border-borde bg-fondo flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
              >
                <span className="min-w-0 text-base">
                  <strong>{cuando(r.creado)}</strong>
                  <span className="text-tinta-suave block text-sm">{resumen(r.estado)}</span>
                </span>
                <button
                  type="button"
                  className="boton-suave"
                  aria-label={`Descargar la copia del ${cuando(r.creado)}`}
                  onClick={() => descargar(r)}
                >
                  Descargar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {mensaje && (
        <p role="status" className="bg-ok-fondo text-ok-texto rounded-2xl p-3 text-base">
          {mensaje}
        </p>
      )}
    </section>
  );
}
