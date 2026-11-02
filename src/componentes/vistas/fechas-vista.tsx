"use client";

import Link from "next/link";
import { useState } from "react";
import { enlaceGoogleCalendar, textoParaKeep } from "@/dominio/agenda";
import { type EventoCalendario, generarIcs } from "@/dominio/compartir";
import { type CuentaAtras, cuentaAtras } from "@/dominio/cuenta-atras";
import { fechasParaCompartir } from "@/aplicacion/compartir";
import { textoFechas } from "@/dominio/compartir";
import { Apuntar } from "../apuntar";
import { BotonesCompartir } from "../compartir-botones";
import { useHogar, useCuenta } from "../proveedor-hogar";
import { useCalendarioFamilia } from "../usar-calendario-familia";

const fechaLarga = (f: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${f}T12:00:00Z`));

function descargar(nombre: string, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const comoEvento = (c: CuentaAtras): EventoCalendario => ({
  fecha: c.fecha,
  titulo: `${c.emoji} ${c.titulo}`,
  descripcion: c.titulo,
  hora: c.hora,
  hasta: c.hasta,
  anual: c.anual,
  aviso: true,
});

/** Dónde se está guardando lo que se apunta, dicho sin tecnicismos. */
function EstadoGuardado() {
  const { fase, sync } = useCuenta();
  const texto =
    fase !== "conectado"
      ? "📱 Solo en este móvil. Entra con tu cuenta (en «Cuenta») para guardarlo en la nube y verlo en el móvil de Ana."
      : sync === "guardando"
        ? "☁️ Guardando en la nube…"
        : sync === "sin-conexion" || sync === "error"
          ? "⚠️ Sin conexión con la nube: se guardará al volver."
          : "☁️ Guardado en la nube y compartido con la familia.";
  return (
    <p role="status" className="bg-suave-1 rounded-2xl p-3 text-base font-semibold">
      {texto}
    </p>
  );
}

/** Módulo de próximas fechas: apuntar, ver lo que viene, copiarlo a Keep y llevarlo al calendario. */
export function FechasVista() {
  const { estado } = useHogar();
  const deGoogle = useCalendarioFamilia(estado.hoy);
  const [aviso, setAviso] = useState("");
  const lista = cuentaAtras(estado.cumples, estado.eventos, estado.hoy, {
    maxDias: 180,
    max: 60,
    externos: [
      ...estado.agenda.map((a) => ({
        fecha: a.fecha,
        titulo: a.titulo,
        hora: a.hora,
        hasta: a.hasta,
      })),
      ...deGoogle,
    ],
  });
  const proximos = estado.agenda.filter((a) => (a.hasta ?? a.fecha) >= estado.hoy);

  async function copiarKeep() {
    const texto = textoParaKeep(proximos, estado.hoy);
    try {
      await navigator.clipboard.writeText(texto);
      setAviso("Copiado. Abre Keep, crea una lista y pega: cada línea será un elemento.");
    } catch {
      setAviso("No he podido copiar. Mantén pulsado el texto de abajo y cópialo a mano.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Próximas fechas <span aria-hidden="true">📌</span>
        </h1>
        <Link href="/calendario" className="boton-suave">
          Calendario
        </Link>
      </header>

      <EstadoGuardado />
      <Apuntar />

      <section aria-labelledby="que-viene" className="tarjeta flex flex-col gap-3">
        <h2 id="que-viene" className="text-xl font-extrabold">
          Lo que viene
        </h2>
        {lista.length === 0 ? (
          <p className="text-tinta-suave text-base">
            Nada en los próximos seis meses. Apunta arriba lo primero.
          </p>
        ) : (
          <ul aria-label="Fechas" className="flex flex-col gap-2">
            {lista.map((c) => (
              <li
                key={c.clave}
                className="border-borde bg-fondo flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
              >
                <p className="min-w-0 text-base">
                  <span aria-hidden="true">{c.emoji} </span>
                  <strong>{c.titulo}</strong>
                  <span className="text-tinta-suave block text-sm">
                    {fechaLarga(c.fecha)}
                    {c.hora ? ` · ${c.hora}` : ""} · {c.dias <= 1 ? c.texto : `en ${c.texto}`}
                  </span>
                </p>
                <span className="flex flex-wrap gap-2">
                  <a
                    className="boton-suave"
                    href={enlaceGoogleCalendar({ ...c, anual: c.anual })}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Añadir ${c.titulo} a Google Calendar`}
                  >
                    ＋ Google
                  </a>
                  <button
                    type="button"
                    className="boton-suave"
                    aria-label={`Descargar ${c.titulo} para el calendario`}
                    onClick={() =>
                      descargar("fecha.ics", generarIcs("Fecha", [comoEvento(c)], new Date()))
                    }
                  >
                    ＋ .ics
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <BotonesCompartir
          titulo="Próximas fechas"
          texto={textoFechas(fechasParaCompartir(estado))}
          deshabilitado={lista.length === 0}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="boton-suave"
            disabled={proximos.length === 0}
            onClick={() => void copiarKeep()}
          >
            📋 Copiar para Keep
          </button>
          <button
            type="button"
            className="boton-suave"
            disabled={lista.length === 0}
            onClick={() => {
              descargar(
                "proximas-fechas.ics",
                generarIcs("Próximas fechas", lista.map(comoEvento), new Date()),
              );
              setAviso(
                "Archivo descargado: ábrelo y elige «Añadir todos» en Calendario, o impórtalo en calendar.google.com.",
              );
            }}
          >
            📅 Todo al calendario (.ics)
          </button>
        </div>
        {aviso && (
          <p role="status" className="bg-ok-fondo text-ok-texto rounded-2xl p-3 text-base">
            {aviso}
          </p>
        )}
        <p className="text-tinta-suave text-sm">
          En Keep: «Copiar para Keep», crea una lista nueva y pega. Cada línea queda como un
          elemento y, si la vuelves a copiar y pegar aquí, se apunta igual.
        </p>
      </section>
    </div>
  );
}
