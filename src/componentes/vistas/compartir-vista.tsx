"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { eventosDeCalendario, planParaCompartir, seccionesDeCompra } from "@/aplicacion/compartir";
import { enlaceWhatsApp, generarIcs, textoCompra, textoMenu } from "@/dominio/compartir";
import { useHogar } from "../proveedor-hogar";

const nadie = () => () => {};

function Tarjeta({
  titulo,
  emoji,
  texto,
  children,
  onAviso,
}: {
  titulo: string;
  emoji: string;
  texto: string;
  children?: React.ReactNode;
  onAviso: (t: string) => void;
}) {
  const puedeCompartir = useSyncExternalStore(
    nadie,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function compartir() {
    try {
      await navigator.share({ title: titulo, text: texto });
    } catch {
      // la persona canceló el cuadro de compartir: no es un error
    }
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      onAviso("Copiado. Pégalo donde quieras (WhatsApp, Keep, notas…).");
    } catch {
      onAviso("No se ha podido copiar: abre «Ver mensaje», selecciónalo y cópialo a mano.");
    }
  }

  return (
    <section className="tarjeta flex flex-col gap-3" aria-label={titulo}>
      <h2 className="text-xl font-extrabold">
        <span aria-hidden="true">{emoji} </span>
        {titulo}
      </h2>
      <div className="flex flex-wrap gap-2">
        <a className="boton" href={enlaceWhatsApp(texto)} target="_blank" rel="noopener noreferrer">
          Enviar por WhatsApp
        </a>
        {puedeCompartir && (
          <button type="button" className="boton-suave" onClick={compartir}>
            Compartir…
          </button>
        )}
        <button type="button" className="boton-suave" onClick={copiar}>
          Copiar
        </button>
        {children}
      </div>
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
  const [aviso, setAviso] = useState("");
  const plan = useMemo(() => planParaCompartir(estado), [estado]);
  const compra = useMemo(() => seccionesDeCompra(estado), [estado]);
  const textoDelMenu = useMemo(() => textoMenu(plan.titulo, plan.dias), [plan]);
  const textoDeCompra = useMemo(() => textoCompra(compra.secciones, compra.manuales), [compra]);
  const hayEventos = estado.comidas.length > 0 || Object.keys(estado.eventos).length > 0;

  function descargarIcs() {
    const ics = generarIcs("Menús Semanales", eventosDeCalendario(estado), new Date());
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

      <Tarjeta titulo={plan.titulo} emoji="🍽️" texto={textoDelMenu} onAviso={setAviso}>
        <button type="button" className="boton-suave" disabled={!hayEventos} onClick={descargarIcs}>
          📅 Calendario (.ics)
        </button>
      </Tarjeta>

      <Tarjeta titulo="Lista de la compra" emoji="🛒" texto={textoDeCompra} onAviso={setAviso} />

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
