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
import {
  FORMATOS_MENU,
  generarIcs,
  textoCasa,
  textoCompra,
  textoFechas,
  textoMenu,
} from "@/dominio/compartir";
import { AvisosCalendario } from "../avisos-calendario";
import { NotificacionesMovil } from "../notificaciones-movil";
import { BotonesCompartir } from "../compartir-botones";
import { useHogar } from "../proveedor-hogar";
import { useFormatoMenu } from "../usar-formato-menu";
import { useYo } from "../yo";

function Tarjeta({
  titulo,
  emoji,
  texto,
  antes,
  children,
}: {
  /** Lo que va entre el título y los botones (p. ej. el selector de formato). */
  antes?: React.ReactNode;
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
      {antes}
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
  const [formato, setFormato] = useFormatoMenu();
  const textoDelMenu = useMemo(() => textoMenu(plan.titulo, plan.dias, formato), [plan, formato]);
  const textoDeFechas = useMemo(() => textoFechas(fechasParaCompartir(estado)), [estado]);
  const textoDeCasa = useMemo(() => textoCasa(casaParaCompartir(estado)), [estado]);
  const textoDeCompra = useMemo(() => textoCompra(compra.secciones, compra.manuales), [compra]);
  const hayEventos = estado.comidas.length > 0 || Object.keys(estado.eventos).length > 0;

  function descargarIcs() {
    const ics = generarIcs("¡Hecho!", eventosDeCalendario(estado, yo), new Date());
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

      <Tarjeta
        titulo={plan.titulo}
        emoji="🍽️"
        texto={textoDelMenu}
        antes={
          <div role="group" aria-label="Formato del mensaje" className="flex flex-wrap gap-2">
            {FORMATOS_MENU.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={formato === f.id}
                title={f.ayuda}
                onClick={() => setFormato(f.id)}
                className={formato === f.id ? "boton" : "boton-suave"}
              >
                {f.nombre}
              </button>
            ))}
          </div>
        }
      >
        <button type="button" className="boton-suave" disabled={!hayEventos} onClick={descargarIcs}>
          📅 Calendario (.ics)
        </button>
      </Tarjeta>

      <Tarjeta titulo="Lista de la compra" emoji="🛒" texto={textoDeCompra} />
      <Tarjeta titulo="Próximas fechas" emoji="📌" texto={textoDeFechas} />
      <Tarjeta titulo="Lo que toca en casa" emoji="🏠" texto={textoDeCasa} />

      <NotificacionesMovil />
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
