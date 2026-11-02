"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  casaParaCompartir,
  eventosDeCalendario,
  fechasParaCompartir,
  planParaCompartir,
  seccionesDeCompra,
} from "@/aplicacion/compartir";
import { generarIcs, textoCasa, textoCompra, textoFechas, textoMenu } from "@/dominio/compartir";
import { AvisosCalendario } from "../avisos-calendario";
import { BotonesCompartir } from "../compartir-botones";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

function Tarjeta({
  titulo,
  emoji,
  texto,
  children,
}: {
  titulo: string;
  emoji: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="tarjeta flex flex-col gap-3" aria-label={titulo}>
      <h2 className="text-xl font-extrabold">
        <span aria-hidden="true">{emoji} </span>
        {titulo}
      </h2>
      <BotonesCompartir titulo={titulo} texto={texto}>
        {children}
      </BotonesCompartir>
      <details>
        <summary className="text-marca-fuerte flex min-h-11 cursor-pointer items-center text-base font-semibold">
          Ver mensaje
        </summary>
        <pre className="bg-fondo border-borde max-h-80 overflow-auto rounded-2xl border p-3 text-base whitespace-pre-wrap">
          {texto}
        </pre>
      </details>
    </section>
  );
}

/** Sacar el plan de la app: mensaje de WhatsApp, lista para Keep y archivo de calendario. */
export function CompartirVista() {
  const { estado } = useHogar();
  const [yo] = useYo();
  const [aviso, setAviso] = useState("");
  const plan = useMemo(() => planParaCompartir(estado), [estado]);
  const compra = useMemo(() => seccionesDeCompra(estado), [estado]);
  const textoDelMenu = useMemo(() => textoMenu(plan.titulo, plan.dias), [plan]);
  const textoDeFechas = useMemo(() => textoFechas(fechasParaCompartir(estado)), [estado]);
  const textoDeCasa = useMemo(() => textoCasa(casaParaCompartir(estado)), [estado]);
  const textoDeCompra = useMemo(() => textoCompra(compra.secciones, compra.manuales), [compra]);
  const hayEventos = estado.comidas.length > 0 || Object.keys(estado.eventos).length > 0;

  function descargarIcs() {
    const ics = generarIcs("Menús Semanales", eventosDeCalendario(estado, yo), new Date());
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "menus-semanales.ics";
    a.click();
    URL.revokeObjectURL(url);
    setAviso(
      "Archivo descargado: ábrelo y elige Google Calendar (o impórtalo en calendar.google.com).",
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Enviar <span aria-hidden="true">📤</span>
        </h1>
        <Link href="/menu" className="boton-suave">
          ← Menú
        </Link>
      </header>

      <Tarjeta titulo={plan.titulo} emoji="🍽️" texto={textoDelMenu}>
        <button type="button" className="boton-suave" disabled={!hayEventos} onClick={descargarIcs}>
          📅 Calendario (.ics)
        </button>
      </Tarjeta>

      <Tarjeta titulo="Lista de la compra" emoji="🛒" texto={textoDeCompra} />
      <Tarjeta titulo="Próximas fechas" emoji="📌" texto={textoDeFechas} />
      <Tarjeta titulo="Lo que toca en casa" emoji="🏠" texto={textoDeCasa} />

      <AvisosCalendario />

      <p className="text-tinta-suave text-base">
        En Google Keep: «Compartir…» → Keep, o «Copiar» y pegar en una nota. En Google Calendar:
        descarga el archivo y ábrelo con Calendar.
      </p>

      {aviso && (
        <p role="status" className="bg-ok-fondo text-ok-texto rounded-2xl p-3 text-base">
          {aviso}
        </p>
      )}
    </div>
  );
}
