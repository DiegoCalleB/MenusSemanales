"use client";

import { useState } from "react";
import type { ResumenTablas } from "@/aplicacion/tablas";
import { useCuenta, useHogar } from "./proveedor-hogar";

const FILAS: Array<[keyof ResumenTablas, string]> = [
  ["personas", "Personas"],
  ["cumples", "Cumpleaños"],
  ["apuntes", "Apuntes de fechas"],
  ["fechas", "Fechas señaladas"],
  ["tareasCasa", "Tareas de la casa"],
  ["tareasPersona", "Tareas por persona"],
  ["dias", "Días de «llego tarde» o «no cenamos»"],
];

interface Vista {
  seLlevaria: ResumenTablas;
  yaHay: ResumenTablas;
}

/**
 * Llevar los datos del documento a tablas (D-094). No borra nada: solo copia lo que hay a las
 * tablas (si se repite, no duplica). Antes guarda una copia en este móvil y enseña qué se llevará.
 */
export function PanelTablas() {
  const { estado } = useHogar();
  const cuenta = useCuenta();
  const [vista, setVista] = useState<Vista | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (cuenta.fase !== "conectado") return null;

  async function previsualizar() {
    setOcupado(true);
    setMensaje("");
    const r = await cuenta.vistaPreviaTablas(estado);
    setOcupado(false);
    if (r.ok) setVista({ seLlevaria: r.seLlevaria, yaHay: r.yaHay });
    else setMensaje(r.mensaje);
  }

  async function importar() {
    setOcupado(true);
    setMensaje("");
    const r = await cuenta.importarATablas(estado);
    if (!r.ok) {
      setOcupado(false);
      setMensaje(r.mensaje);
      return;
    }
    const despues = await cuenta.vistaPreviaTablas(estado);
    setOcupado(false);
    if (despues.ok) {
      setVista({ seLlevaria: despues.seLlevaria, yaHay: despues.yaHay });
      const iguales = FILAS.every(([k]) => despues.yaHay[k] >= despues.seLlevaria[k]);
      setMensaje(
        iguales
          ? "Hecho: las tablas tienen ya todo lo de la tabla de arriba. Tienes una copia en «Copia de seguridad»."
          : "Se envió, pero las tablas tienen menos de lo esperado: no lo repitas y avísame.",
      );
    } else setMensaje("Se envió, pero no he podido comprobarlo: " + despues.mensaje);
  }

  return (
    <section aria-labelledby="tablas" className="tarjeta flex flex-col gap-3">
      <h2 id="tablas" className="text-lg font-extrabold">
        🗄️ Llevar los datos a tablas
      </h2>
      <p className="text-base">
        Copia lo que hay en la app a las tablas de la base de datos. <strong>No borra nada</strong>{" "}
        y se puede repetir sin duplicar. Antes se guarda una copia de seguridad en este móvil. De
        momento la app sigue trabajando con su documento: las tablas son la copia ordenada que
        pasará a ser la principal.
      </p>
      {mensaje && (
        <p role="status" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-3 text-base">
          {mensaje}
        </p>
      )}
      {vista && (
        <table className="w-full text-left text-base">
          <caption className="sr-only">Qué se llevaría a las tablas y qué hay ya</caption>
          <thead>
            <tr className="text-tinta-suave text-sm">
              <th scope="col" className="py-1 pr-2">
                &nbsp;
              </th>
              <th scope="col" className="py-1 pr-2">
                En la app
              </th>
              <th scope="col" className="py-1">
                Ya en tablas
              </th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map(([k, texto]) => (
              <tr key={k}>
                <th scope="row" className="py-1 pr-2 font-semibold">
                  {texto}
                </th>
                <td className="py-1 pr-2">{vista.seLlevaria[k]}</td>
                <td className="py-1">{vista.yaHay[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton-suave" disabled={ocupado} onClick={previsualizar}>
          Ver qué se llevará
        </button>
        {vista && (
          <button type="button" className="boton" disabled={ocupado} onClick={importar}>
            Llevar a tablas ahora
          </button>
        )}
      </div>
      <p className="text-tinta-suave text-sm">
        Si eres quien cumple años, tu propio regalo y sus ideas no se tocan (son un secreto: solo
        pueden escribirlos los demás).
      </p>
    </section>
  );
}
