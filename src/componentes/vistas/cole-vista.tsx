"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { TEXTO_MENU_COLE_NOVIEMBRE_2026 } from "@/dominio/menu-cole-ejemplo";
import { GRUPOS_PLATO, type GrupoPlato } from "@/dominio/menu";
import { type DiaCole, type MenuColeLeido, aMenuCole, leerMenuCole } from "@/dominio/menu-cole";
import { useHogar } from "../proveedor-hogar";

const MAX_CARACTERES = 30000;
const NOMBRE_GRUPO: Record<GrupoPlato, string> = {
  verdura: "Verdura",
  legumbre: "Legumbres",
  pasta: "Pasta",
  arroz: "Arroz",
  pescado: "Pescado",
  carne: "Carne",
  huevo: "Huevo",
  otro: "Otro (sin regla)",
};
const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function SelectorGrupo({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: GrupoPlato | null;
  onCambio: (g: GrupoPlato | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {etiqueta}
      <select
        className="campo"
        value={valor ?? ""}
        onChange={(e) => onCambio(e.target.value === "" ? null : (e.target.value as GrupoPlato))}
      >
        <option value="">Sin clasificar</option>
        {GRUPOS_PLATO.map((g) => (
          <option key={g} value={g}>
            {NOMBRE_GRUPO[g]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Importar el menú mensual del cole: se pega el texto del PDF, se lee, se revisan los grupos y se
 * guarda. Con el menú del mes se puede proponer la mejor cena de cada día y adelantar la compra.
 */
export function ColeVista() {
  const { estado, despachar } = useHogar();
  const idTexto = useId();
  const [texto, setTexto] = useState("");
  const [leido, setLeido] = useState<MenuColeLeido | null>(null);

  const diasGuardados = Object.keys(estado.colegio).length;

  function leer() {
    setLeido(leerMenuCole(texto));
  }
  function cambiar(fecha: string, campo: "grupoPrimero" | "grupoSegundo", g: GrupoPlato | null) {
    setLeido((l) =>
      l ? { ...l, dias: l.dias.map((d) => (d.fecha === fecha ? { ...d, [campo]: g } : d)) } : l,
    );
  }
  function guardar() {
    if (!leido || leido.dias.length === 0) return;
    despachar({ tipo: "cole/importar", dias: aMenuCole(leido.dias) });
    setLeido(null);
    setTexto("");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/menu" className="boton-suave w-fit">
          ← Volver al menú
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Menú del cole <span aria-hidden="true">🎒</span>
        </h1>
        <p className="text-tinta-suave text-base">{diasGuardados} días guardados</p>
      </header>

      <section className="tarjeta flex flex-col gap-3" aria-labelledby="pegar">
        <h2 id="pegar" className="text-xl font-semibold">
          1. Pega el menú del mes
        </h2>
        <p className="text-tinta-suave text-base">
          Abre el PDF del cole, selecciona todo el texto, cópialo y pégalo aquí. Debe incluir el
          título con el mes (por ejemplo «Menú Noviembre 2026»).
        </p>
        <label htmlFor={idTexto} className="sr-only">
          Texto del menú del cole
        </label>
        <textarea
          id={idTexto}
          className="campo min-h-48 py-2 font-mono text-sm"
          maxLength={MAX_CARACTERES}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="MENÚ Noviembre 2026&#10;3&#10;Guiso de lentejas…"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" disabled={texto.trim() === ""} onClick={leer}>
            Leer menú
          </button>
          <button
            type="button"
            className="boton-suave"
            onClick={() => setTexto(TEXTO_MENU_COLE_NOVIEMBRE_2026)}
          >
            Usar el ejemplo de noviembre
          </button>
        </div>
      </section>

      {leido && (
        <section className="tarjeta flex flex-col gap-4" aria-labelledby="revisar">
          <h2 id="revisar" className="text-xl font-semibold">
            2. Revisa lo leído ({leido.dias.length} días)
          </h2>
          {leido.avisos.length > 0 && (
            <ul
              role="alert"
              className="bg-aviso-fondo text-aviso-texto flex flex-col gap-1 rounded-xl p-3 text-base"
            >
              {leido.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <ul className="flex flex-col gap-3">
            {leido.dias.map((d: DiaCole) => (
              <li key={d.fecha} className="border-borde rounded-xl border p-3">
                <p className="text-base font-semibold">
                  {formatoFecha.format(new Date(`${d.fecha}T00:00:00Z`))}
                </p>
                <p className="text-base">{d.primero}</p>
                <p className="text-base">{d.segundo}</p>
                {(d.guarnicion || d.postre) && (
                  <p className="text-tinta-suave text-sm">
                    {[d.guarnicion, d.postre].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <SelectorGrupo
                    etiqueta={`Primero del ${d.fecha}`}
                    valor={d.grupoPrimero}
                    onCambio={(g) => cambiar(d.fecha, "grupoPrimero", g)}
                  />
                  <SelectorGrupo
                    etiqueta={`Segundo del ${d.fecha}`}
                    valor={d.grupoSegundo}
                    onCambio={(g) => cambiar(d.fecha, "grupoSegundo", g)}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="boton"
              disabled={leido.dias.length === 0}
              onClick={guardar}
            >
              Guardar menú del cole
            </button>
            <button type="button" className="boton-suave" onClick={() => setLeido(null)}>
              Descartar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
