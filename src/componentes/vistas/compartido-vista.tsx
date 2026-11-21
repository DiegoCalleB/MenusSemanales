"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ItemCircular } from "@/dominio/ia-circular";
import { LeerCircular } from "../leer-circular";
import { useHogar } from "../proveedor-hogar";
import { useYo } from "../yo";

/** Dónde deja el service worker la foto o el PDF compartido (ver `public/sw.js`). */
const CACHE_COMPARTIDO = "hecho-compartido";
const ARCHIVO_COMPARTIDO = "/compartido/archivo";

/** Junta título, texto y enlace sin repetir (WhatsApp a veces manda lo mismo en dos campos). */
export function textoCompartido(campos: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): string {
  const partes: string[] = [];
  for (const v of [campos.title, campos.text, campos.url]) {
    const t = (v ?? "").trim();
    if (t && !partes.some((p) => p.includes(t))) partes.push(t);
  }
  return partes.join("\n").slice(0, 6000);
}

async function sacarArchivo(): Promise<File | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(CACHE_COMPARTIDO);
  const r = await cache.match(ARCHIVO_COMPARTIDO);
  if (!r) return null;
  const blob = await r.blob();
  await cache.delete(ARCHIVO_COMPARTIDO);
  const nombre = decodeURIComponent(r.headers.get("X-Nombre") ?? "archivo");
  return new File([blob], nombre, { type: blob.type || r.headers.get("Content-Type") || "" });
}

const fechaCorta = (f: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${f}T12:00:00Z`));

/**
 * Lo que se comparte con la app desde otra (D-138): un mensaje del grupo del cole, la foto de una
 * circular o el cartel de un evento… La IA lo lee y lo apunta solo (D-160), y se enseña lo apuntado
 * con «Quitar» por si algo no es. También se puede mandar a la lista de la compra.
 */
export function CompartidoVista() {
  const { estado, despachar } = useHogar();
  const [yoId] = useYo();
  const yo = estado.personas.find((p) => p.id === yoId && p.activa);
  const [apuntadas, setApuntadas] = useState<readonly ItemCircular[]>([]);
  const [quitadas, setQuitadas] = useState<ReadonlySet<number>>(new Set());
  const params = useSearchParams();
  const texto = textoCompartido({
    title: params.get("title"),
    text: params.get("text"),
    url: params.get("url"),
  });
  const conArchivo = params.get("archivo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [buscando, setBuscando] = useState(conArchivo === "1");
  const [hecho, setHecho] = useState<string | null>(null);

  useEffect(() => {
    if (conArchivo !== "1") return;
    let vivo = true;
    sacarArchivo()
      .then((f) => vivo && setArchivo(f))
      .catch(() => {})
      .finally(() => vivo && setBuscando(false));
    return () => {
      vivo = false;
    };
  }, [conArchivo]);

  const inicial = useMemo(
    () => (archivo ? { archivo } : texto ? { texto } : undefined),
    [archivo, texto],
  );
  const nada = !texto && !archivo && !buscando;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Compartido con ¡Hecho! <span aria-hidden="true">📥</span>
        </h1>
        {!nada && (
          <p className="text-tinta-suave text-base">
            Busco las fechas y lo que hay que hacer, y lo apunto. Si algo no es, lo quitas.
          </p>
        )}
      </header>

      {hecho ? (
        <section className="tarjeta flex flex-col gap-3" aria-live="polite">
          <p className="text-lg font-bold">✅ {hecho}</p>
          {apuntadas.length > 0 && (
            <ul aria-label="Apuntado" className="flex flex-col gap-2">
              {apuntadas.map((c, i) => {
                const cita = c.fecha
                  ? estado.agenda.find(
                      (a) =>
                        a.fecha === c.fecha && a.titulo.toLowerCase() === c.titulo.toLowerCase(),
                    )
                  : undefined;
                const quitada = quitadas.has(i);
                return (
                  <li
                    key={`${c.fecha ?? ""}-${c.titulo}`}
                    className="bg-suave-1 flex items-center justify-between gap-2 rounded-2xl p-3"
                  >
                    <span className={`text-base ${quitada ? "line-through opacity-60" : ""}`}>
                      {c.fecha
                        ? `📌 ${fechaCorta(c.fecha)}${c.hora ? ` · ${c.hora}` : ""} · `
                        : "✅ "}
                      {c.titulo}
                    </span>
                    {cita && !quitada && (
                      <button
                        type="button"
                        className="boton-suave shrink-0"
                        aria-label={`Quitar ${c.titulo}`}
                        onClick={() => {
                          despachar({ tipo: "agenda/borrar", id: cita.id });
                          setQuitadas((q) => new Set(q).add(i));
                        }}
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/fechas" className="boton">
              Ver las fechas
            </Link>
            <Link href="/" className="boton-suave">
              Ir a Hoy
            </Link>
          </div>
        </section>
      ) : (
        <>
          {texto && (
            <blockquote className="border-borde bg-fondo text-tinta-suave max-h-48 overflow-auto rounded-2xl border p-3 text-base whitespace-pre-wrap">
              {texto}
            </blockquote>
          )}
          {conArchivo === "perdido" && (
            <p role="status" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-3 text-base">
              La foto no ha llegado (la app aún se estaba preparando). Vuelve a compartirla.
            </p>
          )}
          {buscando && <p className="text-base">Recogiendo lo compartido…</p>}

          {inicial && (
            <LeerCircular
              key={archivo ? "archivo" : "texto"}
              inicial={inicial}
              automatico
              alTerminar={(n, cosas) => {
                setApuntadas(cosas);
                setHecho(
                  n === 0
                    ? "No se ha apuntado nada."
                    : `${n === 1 ? "Apuntada 1 cosa" : `Apuntadas ${n} cosas`}.`,
                );
              }}
            />
          )}

          {texto && (
            <button
              type="button"
              className="boton-suave w-fit"
              onClick={() => {
                despachar({ tipo: "manual/anadir", nombre: texto });
                setHecho("Añadido a la lista de la compra.");
              }}
            >
              🛒 Es para la compra
            </button>
          )}

          {texto && yo && (
            <button
              type="button"
              className="boton-suave w-fit"
              onClick={() => {
                despachar({
                  tipo: "nota/anadir",
                  personaId: yo.id,
                  nota: "idea",
                  texto: texto.slice(0, 500),
                  sobre: null,
                });
                setHecho("Guardada como idea en tus notas.");
              }}
            >
              💡 Es una idea (a mis notas)
            </button>
          )}

          {nada && (
            <section className="tarjeta flex flex-col gap-2">
              <p className="text-base">
                Desde WhatsApp (o la galería), mantén pulsado un mensaje o una foto, toca{" "}
                <strong>Compartir</strong> y elige <strong>¡Hecho!</strong>. Aquí te propongo las
                fechas para apuntarlas.
              </p>
              <p className="text-tinta-suave text-sm">
                Funciona con la app instalada en el móvil (Android). En el iPhone, copia el texto y
                pégalo en «Leer una circular del cole».
              </p>
              <LeerCircular />
            </section>
          )}
        </>
      )}
    </div>
  );
}
