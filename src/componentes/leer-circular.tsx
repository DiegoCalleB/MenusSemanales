"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MAX_BYTES_CIRCULAR, type ItemCircular } from "@/dominio/ia-circular";
import { TIPOS_ARCHIVO_COLE } from "@/dominio/ia-cole";
import { mensajeDeIa } from "./ia-mensajes";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

type Fila = ItemCircular & { elegido: boolean };

const fechaCorta = (f: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${f}T12:00:00Z`),
  );

/**
 * Leer una circular o nota del cole con IA (D-116): subes una foto o un PDF (o pegas el texto) y
 * la IA saca las citas con día y las tareas sin día. Tú revisas la lista, quitas lo que no quieras
 * y apuntas el resto. La IA solo propone.
 */
export function LeerCircular({
  inicial,
  alTerminar,
}: {
  /** Lo que llega compartido desde otra app (D-138): se lee nada más abrir. */
  inicial?: { texto?: string; archivo?: File };
  /** Tras apuntar (o descartar) lo leído. */
  alTerminar?: (apuntadas: number) => void;
} = {}) {
  const { despachar } = useHogar();
  const [yo] = useYo();
  const idArchivo = useId();
  const idTexto = useId();
  const [abierto, setAbierto] = useState(Boolean(inicial));
  const [texto, setTexto] = useState(inicial?.texto ?? "");
  const [leyendo, setLeyendo] = useState(false);
  const [problema, setProblema] = useState("");
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [pasados, setPasados] = useState(0);

  async function leer(cuerpo: FormData) {
    setLeyendo(true);
    setProblema("");
    setFilas(null);
    try {
      const r = await fetch("/api/ia/circular", { method: "POST", body: cuerpo });
      const datos = (await r.json().catch(() => ({}))) as {
        items?: ItemCircular[];
        pasados?: number;
        error?: string;
        motivo?: string;
      };
      if (!r.ok) {
        setProblema(mensajeDeIa(datos));
        return;
      }
      setPasados(datos.pasados ?? 0);
      const lista = (datos.items ?? []).map((i) => ({ ...i, elegido: true }));
      if (lista.length === 0) {
        setProblema(
          "No he encontrado nada que recordar en ese documento. Prueba con otra foto o pega el texto.",
        );
        return;
      }
      setFilas(lista);
    } catch {
      setProblema("Sin conexión. Inténtalo de nuevo.");
    } finally {
      setLeyendo(false);
    }
  }

  // Lo compartido se lee solo, una vez.
  const leido = useRef(false);
  useEffect(() => {
    if (leido.current || !inicial) return;
    const d = new FormData();
    if (inicial.archivo) d.append("archivo", inicial.archivo);
    else if (inicial.texto && inicial.texto.trim().length >= 5) d.append("texto", inicial.texto);
    else return;
    leido.current = true;
    void Promise.resolve().then(() => leer(d));
  }, [inicial]);

  function subir(archivo: File | undefined) {
    if (!archivo) return;
    if (archivo.size > MAX_BYTES_CIRCULAR) {
      setProblema(mensajeDeIa({ error: "demasiado-grande" }));
      return;
    }
    const d = new FormData();
    d.append("archivo", archivo);
    void leer(d);
  }

  function cambiar(i: number, cambio: Partial<Fila>) {
    setFilas((f) => f?.map((x, n) => (n === i ? { ...x, ...cambio } : x)) ?? f);
  }

  function apuntar() {
    if (!filas) return;
    const elegidas = filas.filter((f) => f.elegido && f.titulo.trim() !== "");
    for (const f of elegidas) {
      if (f.fecha) {
        despachar({
          tipo: "agenda/cita",
          fecha: f.fecha,
          hasta: f.hasta,
          hora: f.hora,
          titulo: f.titulo,
        });
      } else if (yo) {
        despachar({ tipo: "tarea/anadir", personaId: yo, texto: f.titulo, frecuencia: "puntual" });
      }
    }
    setFilas(null);
    setTexto("");
    setAbierto(false);
    alTerminar?.(elegidas.length);
  }

  const total = filas?.filter((f) => f.elegido).length ?? 0;

  if (!abierto) {
    return (
      <button type="button" className="boton-suave w-fit" onClick={() => setAbierto(true)}>
        ✨ Leer una circular del cole
      </button>
    );
  }

  return (
    <section aria-label="Leer una circular del cole" className="tarjeta flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-extrabold">✨ Circular del cole</h2>
        <button type="button" className="boton-suave px-4" onClick={() => setAbierto(false)}>
          Cerrar
        </button>
      </div>
      <p className="text-tinta-suave text-base">
        Sube una foto o un PDF de una circular, nota o calendario del cole (o pega el texto) y saco
        las citas y lo que hay que hacer. Tú revisas antes de apuntar. El archivo se envía a una IA
        (Gemini, de Google) para leerlo y no se guarda.
      </p>

      {filas === null && (
        <>
          <div className="flex flex-col gap-2">
            <label
              htmlFor={idArchivo}
              className={`boton w-fit cursor-pointer ${leyendo ? "pointer-events-none opacity-60" : ""}`}
            >
              {leyendo ? "Leyendo…" : "📷 Subir foto o PDF"}
            </label>
            <input
              id={idArchivo}
              type="file"
              accept={TIPOS_ARCHIVO_COLE.join(",")}
              className="sr-only"
              disabled={leyendo}
              onChange={(e) => {
                subir(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <label htmlFor={idTexto} className="text-base font-semibold">
            …o pega el texto
          </label>
          <textarea
            id={idTexto}
            className="campo min-h-28 py-2"
            value={texto}
            maxLength={6000}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Excursión al zoo el 17 de noviembre, traer almuerzo…"
          />
          <button
            type="button"
            className="boton w-fit"
            disabled={leyendo || texto.trim().length < 5}
            onClick={() => {
              const d = new FormData();
              d.append("texto", texto);
              void leer(d);
            }}
          >
            Leer el texto
          </button>
        </>
      )}

      {problema && (
        <p role="status" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-3 text-base">
          {problema}
        </p>
      )}

      {filas && (
        <div className="flex flex-col gap-3">
          <p className="text-base font-bold">
            Esto es lo que he encontrado. Revísalo (la IA puede equivocarse):
          </p>
          {pasados > 0 && (
            <p className="text-tinta-suave text-sm">
              {pasados} {pasados === 1 ? "cosa" : "cosas"} ya pasada{pasados === 1 ? "" : "s"}: no
              se incluye{pasados === 1 ? "" : "n"}.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {filas.map((f, i) => (
              <li key={i} className="border-borde flex flex-col gap-2 rounded-2xl border p-3">
                <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
                  <input
                    type="checkbox"
                    className="size-6 accent-[var(--marca)]"
                    checked={f.elegido}
                    onChange={(e) => cambiar(i, { elegido: e.target.checked })}
                  />
                  <span className="sr-only">Apuntar: </span>
                  {f.fecha ? "📌 Cita" : "✅ Tarea"}
                  {f.fecha && (
                    <span className="text-tinta-suave font-normal">
                      {" "}
                      · {fechaCorta(f.fecha)}
                      {f.hasta ? ` – ${fechaCorta(f.hasta)}` : ""}
                      {f.hora ? ` · ${f.hora}` : ""}
                    </span>
                  )}
                </label>
                <input
                  className="campo"
                  aria-label={`Título ${i + 1}`}
                  value={f.titulo}
                  maxLength={200}
                  onChange={(e) => cambiar(i, { titulo: e.target.value })}
                />
              </li>
            ))}
          </ul>
          {!yo && filas.some((f) => !f.fecha && f.elegido) && (
            <p className="text-aviso-texto text-sm">
              Elige tu perfil (el botón con tu inicial) para apuntar las tareas sin día.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton" disabled={total === 0} onClick={apuntar}>
              Apuntar {total} {total === 1 ? "cosa" : "cosas"}
            </button>
            <button type="button" className="boton-suave" onClick={() => setFilas(null)}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
