"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { accionesDeCaptura } from "@/aplicacion/captura";
import { reducir } from "@/aplicacion/estado";
import { type ItemCaptura, MAX_TEXTO_CAPTURA, TEXTO_TIPO_CAPTURA } from "@/dominio/ia-captura";
import { fechaLegible } from "@/aplicacion/buscar";
import { useHogar } from "./proveedor-hogar";
import { constructorVoz, nadie, problemaDeVoz } from "./voz";

type Fase = "escribir" | "pensando" | "revisar";

function detalleDe(i: ItemCaptura, quien: string | null): string {
  const partes = [
    i.fecha
      ? `${fechaLegible(i.fecha)}${i.hasta ? ` – ${fechaLegible(i.hasta)}` : ""}${i.hora ? ` · ${i.hora}` : ""}`
      : "",
    quien ?? "",
    i.importante ? "⭐ importante" : "",
    i.repiteMeses
      ? `se repite cada ${i.repiteMeses === 12 ? "año" : `${i.repiteMeses} meses`}`
      : "",
  ].filter(Boolean);
  return partes.join(" · ");
}

/**
 * Una sola caja para apuntarlo todo (D-178): se escribe o se dicta («pañales y leche, el jueves a las
 * seis pediatra de Alba, llamar al fontanero…»), la IA lo reparte en compra, citas, pendientes y
 * papeles y la persona elige qué se apunta. Nada se apunta sin que lo vea.
 */
export function CapturaRapida({ alTerminar }: { alTerminar: () => void }) {
  const { estado, despachar } = useHogar();
  const [fase, setFase] = useState<Fase>("escribir");
  const [texto, setTexto] = useState("");
  const [items, setItems] = useState<ItemCaptura[]>([]);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [problema, setProblema] = useState("");
  const [pasados, setPasados] = useState(0);
  const [escuchando, setEscuchando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const hayVoz = useSyncExternalStore(
    nadie,
    () => constructorVoz() !== null,
    () => false,
  );
  const personas = estado.personas.filter((p) => p.activa);

  async function entender() {
    const t = texto.trim();
    if (t.length < 3) {
      setProblema("Escribe algo para apuntar.");
      return;
    }
    setProblema("");
    setFase("pensando");
    try {
      const r = await fetch("/api/ia/captura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t, personas: personas.map((p) => p.nombre) }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setProblema(
          r.status === 429
            ? "Hoy ya has usado todas las lecturas con IA. Usa Compra, Evento o Pendiente."
            : r.status === 401 || r.status === 403
              ? "Para esto hay que entrar con tu cuenta. Usa Compra, Evento o Pendiente."
              : j.error === "ia-no-configurada"
                ? "La IA no está activada. Usa Compra, Evento o Pendiente."
                : "No he podido entenderlo ahora. Prueba otra vez o usa Compra, Evento o Pendiente.",
        );
        setFase("escribir");
        return;
      }
      const j = (await r.json()) as { items?: ItemCaptura[]; pasados?: number };
      const lista = Array.isArray(j.items) ? j.items : [];
      setItems(lista);
      setElegidos(new Set(lista.map((_, i) => i)));
      setPasados(j.pasados ?? 0);
      if (lista.length === 0) {
        setProblema(
          j.pasados
            ? "Lo que has dicho ya pasó. Cuéntamelo con otra fecha."
            : "No he encontrado nada que apuntar. Prueba a decirlo de otra forma.",
        );
        setFase("escribir");
        return;
      }
      setFase("revisar");
    } catch {
      setProblema("Parece que no hay conexión. Prueba otra vez o usa Compra, Evento o Pendiente.");
      setFase("escribir");
    }
  }

  function apuntar() {
    const indices = items.map((_, i) => i).filter((i) => elegidos.has(i));
    const acciones = accionesDeCaptura(
      indices.map((i) => items[i]!),
      estado.personas,
      () => crypto.randomUUID(),
    );
    let estadoPrueba = estado;
    let hechas = 0;
    const fallidos: number[] = [];
    let motivo = "";
    acciones.forEach((accion, k) => {
      const siguiente = reducir(estadoPrueba, accion);
      if (siguiente.aviso?.tipo === "error") {
        fallidos.push(indices[k]!);
        motivo ||= siguiente.aviso.texto;
        return;
      }
      despachar(accion);
      estadoPrueba = siguiente;
      hechas += 1;
    });
    if (fallidos.length > 0) {
      // Se quedan en la lista solo las que no se pudieron apuntar, para corregirlas o dejarlas.
      setProblema(`Apunté ${hechas} y no pude apuntar ${fallidos.length}: ${motivo}`);
      setItems(fallidos.map((i) => items[i]!));
      setElegidos(new Set(fallidos.map((_, k) => k)));
      return;
    }
    setTexto("");
    setItems([]);
    alTerminar();
  }

  function dictar() {
    const Voz = constructorVoz();
    if (!Voz) return;
    setProblema("");
    const r = new Voz();
    r.lang = "es-ES";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const dicho = e.results[0]?.[0]?.transcript ?? "";
      if (dicho.trim() !== "")
        setTexto((t) => `${t.trim()}${t.trim() ? ". " : ""}${dicho}`.slice(0, MAX_TEXTO_CAPTURA));
    };
    r.onerror = (e) => {
      setProblema(problemaDeVoz(e.error ?? ""));
      campo.current?.focus();
    };
    r.onend = () => setEscuchando(false);
    setEscuchando(true);
    try {
      r.start();
    } catch {
      setEscuchando(false);
    }
  }

  if (fase === "revisar") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-base font-bold">Esto es lo que he entendido</p>
        <ul aria-label="Lo que se va a apuntar" className="flex flex-col gap-1">
          {items.map((i, n) => {
            const t = TEXTO_TIPO_CAPTURA[i.tipo];
            const quien = i.persona
              ? (personas.find((p) => p.nombre.toLowerCase() === i.persona?.toLowerCase())
                  ?.nombre ?? i.persona)
              : null;
            const d = detalleDe(i, quien);
            return (
              <li key={`${n}-${i.titulo}`}>
                <label className="border-borde bg-fondo flex min-h-11 items-start gap-3 rounded-2xl border p-2 text-base">
                  <input
                    type="checkbox"
                    className="mt-1 size-6 shrink-0 accent-[var(--marca)]"
                    checked={elegidos.has(n)}
                    onChange={() =>
                      setElegidos((s) => {
                        const nuevo = new Set(s);
                        if (nuevo.has(n)) nuevo.delete(n);
                        else nuevo.add(n);
                        return nuevo;
                      })
                    }
                  />
                  <span>
                    <span className="text-tinta-suave text-sm font-semibold">
                      <span aria-hidden="true">{t.emoji} </span>
                      {t.texto}
                    </span>
                    <strong className="block">{i.titulo}</strong>
                    {d && <span className="text-tinta-suave block text-sm">{d}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {pasados > 0 && (
          <p className="text-tinta-suave text-sm">
            {pasados === 1
              ? "Había 1 cita que ya pasó y no la incluyo."
              : `Había ${pasados} citas que ya pasaron y no las incluyo.`}
          </p>
        )}
        {problema && (
          <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
            {problema}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" disabled={elegidos.size === 0} onClick={apuntar}>
            Apuntar {elegidos.size} {elegidos.size === 1 ? "cosa" : "cosas"}
          </button>
          <button
            type="button"
            className="boton-suave"
            onClick={() => {
              setFase("escribir");
              setProblema("");
            }}
          >
            ← Cambiar el texto
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      aria-label="Apuntar de todo"
      onSubmit={(e) => {
        e.preventDefault();
        void entender();
      }}
    >
      <label className="flex flex-col gap-1 text-base font-semibold">
        <span className="sr-only">Qué quieres apuntar</span>
        <textarea
          ref={campo}
          className="campo min-h-24 py-2"
          value={texto}
          maxLength={MAX_TEXTO_CAPTURA}
          disabled={fase === "pensando"}
          placeholder="Pañales y leche, el jueves a las seis pediatra de Alba, llamar al fontanero…"
          onChange={(e) => setTexto(e.target.value)}
        />
      </label>
      <p className="text-tinta-suave text-sm">
        Escribe o dicta lo que quieras, todo junto. Lo reparto entre compra, citas, pendientes y
        papeles y tú eliges qué se apunta.
      </p>
      {problema && (
        <p role="alert" className="bg-aviso-fondo text-aviso-texto rounded-2xl p-2 text-sm">
          {problema}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="boton" disabled={fase === "pensando"}>
          {fase === "pensando" ? "Pensando…" : "✨ Entender"}
        </button>
        {hayVoz && (
          <button
            type="button"
            className={escuchando ? "boton" : "boton-suave"}
            aria-pressed={escuchando}
            aria-label="Dictar por voz"
            disabled={fase === "pensando"}
            onClick={dictar}
          >
            <span aria-hidden="true">🎤</span>
          </button>
        )}
      </div>
    </form>
  );
}
