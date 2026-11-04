"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { VISTAS_PLATOS, useVistaPlatos } from "@/componentes/usar-vista-platos";
import { avisosDePlato, normalizarNombre, validarPlato } from "@/dominio/catalogo";
import {
  type FilaPropuesta,
  MAX_CATALOGO_IA,
  enlazarConCatalogo,
  propuestaPlatoSchema,
} from "@/dominio/ia-plato";
import { GRUPOS_PLATO, type GrupoPlato, type PlatoMenu } from "@/dominio/menu";
import { SECCIONES, type Seccion, type Unidad } from "@/dominio/tipos";
import { EMOJI_GRUPO, NOMBRE_SECCION, formatearNumero } from "../formato";
import { mensajeDeIa } from "../ia-mensajes";
import { useHogar } from "../proveedor-hogar";

const NOMBRE_GRUPO: Record<GrupoPlato, string> = {
  verdura: "Verdura",
  legumbre: "Legumbres",
  pasta: "Pasta",
  arroz: "Arroz",
  pescado: "Pescado",
  carne: "Carne",
  huevo: "Huevo",
  otro: "Otro",
};

interface FilaIngrediente {
  clave: number;
  ingredienteId: string;
  cantidad: string;
  opcional: boolean;
  /** Ingrediente nuevo propuesto por la IA que aún se está creando: su nombre. */
  pendiente?: string;
}
interface PropuestaVista {
  grupo: GrupoPlato;
  minutos: number;
  ligero: boolean;
  pasos: string;
  filas: FilaPropuesta[];
}
interface Borrador {
  id?: string;
  nombre: string;
  grupo: GrupoPlato;
  minutos: string;
  pasos: string;
  ligero: boolean;
  filas: FilaIngrediente[];
}

const vacio = (): Borrador => ({
  nombre: "",
  grupo: "otro",
  minutos: "20",
  pasos: "",
  ligero: false,
  filas: [{ clave: 0, ingredienteId: "", cantidad: "", opcional: false }],
});

function desdePlato(p: PlatoMenu): Borrador {
  return {
    id: p.id,
    nombre: p.nombre,
    grupo: p.grupo,
    minutos: String(p.minutosActivos),
    pasos: p.pasos ?? "",
    ligero: !!p.ligero,
    filas: p.ingredientes.map((i, n) => ({
      clave: n,
      ingredienteId: i.ingredienteId,
      cantidad: String(i.cantidadPorRacion),
      opcional: i.opcional,
    })),
  };
}

export function PlatosVista() {
  const { estado, despachar } = useHogar();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState<GrupoPlato | "">("");
  const [aBorrar, setABorrar] = useState<string | null>(null);
  const [vista, setVista] = useVistaPlatos();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevoIng, setNuevoIng] = useState<{
    nombre: string;
    unidad: Unidad;
    seccion: Seccion;
  } | null>(null);
  const [ia, setIa] = useState<{
    cargando: boolean;
    problema: string;
    propuesta: PropuestaVista | null;
  }>({ cargando: false, problema: "", propuesta: null });
  const id = useId();

  // Los ingredientes nuevos que propuso la IA se crean al usar la propuesta; cuando ya existen,
  // se enlazan a su fila del formulario.
  useEffect(() => {
    void Promise.resolve().then(() =>
      setBorrador((b) => {
        if (!b || !b.filas.some((f) => f.pendiente)) return b;
        let cambio = false;
        const filas = b.filas.map((f) => {
          if (!f.pendiente) return f;
          const ing = estado.ingredientes.find(
            (i) => normalizarNombre(i.nombre) === normalizarNombre(f.pendiente ?? ""),
          );
          if (!ing) return f;
          cambio = true;
          return { ...f, ingredienteId: ing.id, pendiente: undefined };
        });
        return cambio ? { ...b, filas } : b;
      }),
    );
  }, [estado.ingredientes]);

  async function completarConIa(de: Borrador) {
    if (de.nombre.trim().length < 2) return;
    setIa({ cargando: true, problema: "", propuesta: null });
    try {
      const r = await fetch("/api/ia/plato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: de.nombre.trim(),
          ...(de.grupo !== "otro" ? { grupo: de.grupo } : {}),
          catalogo: estado.ingredientes
            .slice(0, MAX_CATALOGO_IA)
            .map((i) => ({ nombre: i.nombre, unidad: i.unidad })),
        }),
      });
      const datos = (await r.json().catch(() => ({}))) as {
        propuesta?: unknown;
        error?: string;
        motivo?: string;
      };
      if (!r.ok) {
        setIa({ cargando: false, problema: mensajeDeIa(datos), propuesta: null });
        return;
      }
      const v = propuestaPlatoSchema.safeParse(datos.propuesta);
      if (!v.success) {
        setIa({
          cargando: false,
          problema:
            "La IA no ha sabido proponer ese plato. Prueba con otro nombre o escríbelo a mano.",
          propuesta: null,
        });
        return;
      }
      setIa({
        cargando: false,
        problema: "",
        propuesta: {
          grupo: v.data.grupo,
          minutos: v.data.minutosActivos,
          ligero: v.data.ligero,
          pasos: v.data.pasos,
          filas: enlazarConCatalogo(v.data.ingredientes, estado.ingredientes),
        },
      });
    } catch {
      setIa({ cargando: false, problema: "Sin conexión. Inténtalo de nuevo.", propuesta: null });
    }
  }

  function usarPropuesta() {
    const p = ia.propuesta;
    if (!p || !borrador) return;
    for (const f of p.filas) {
      if (!f.ingredienteId) {
        despachar({
          tipo: "ingrediente/crear",
          ingrediente: { nombre: f.nombre, unidad: f.unidad, seccion: f.seccion },
        });
      }
    }
    setBorrador({
      ...borrador,
      grupo: borrador.grupo === "otro" ? p.grupo : borrador.grupo,
      minutos: String(p.minutos),
      pasos: borrador.pasos.trim() === "" ? p.pasos : borrador.pasos,
      ligero: borrador.ligero || p.ligero,
      filas: p.filas.map((f, n) => ({
        clave: n,
        ingredienteId: f.ingredienteId ?? "",
        ...(f.ingredienteId ? {} : { pendiente: f.nombre }),
        cantidad: String(f.cantidad),
        opcional: f.opcional,
      })),
    });
    setIa({ cargando: false, problema: "", propuesta: null });
  }

  const ingredientes = useMemo(
    () => [...estado.ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [estado.ingredientes],
  );
  const porId = useMemo(
    () => new Map(estado.ingredientes.map((i) => [i.id, i])),
    [estado.ingredientes],
  );

  const platos = useMemo(() => {
    const q = normalizarNombre(busqueda);
    return estado.platos
      .filter((p) => (grupo ? p.grupo === grupo : true) && normalizarNombre(p.nombre).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [estado.platos, busqueda, grupo]);

  function cambiarFila(clave: number, cambio: Partial<FilaIngrediente>) {
    setBorrador((b) =>
      b ? { ...b, filas: b.filas.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)) } : b,
    );
  }

  function guardar() {
    if (!borrador) return;
    const r = validarPlato(
      {
        nombre: borrador.nombre,
        grupo: borrador.grupo,
        minutosActivos: Number(borrador.minutos),
        pasos: borrador.pasos.trim() === "" ? null : borrador.pasos,
        ligero: borrador.ligero,
        ingredientes: borrador.filas
          .filter((f) => f.ingredienteId !== "" || f.cantidad !== "")
          .map((f) => ({
            ingredienteId: f.ingredienteId,
            cantidadPorRacion: Number(f.cantidad.replace(",", ".")),
            opcional: f.opcional,
          })),
      },
      new Set(estado.ingredientes.map((i) => i.id)),
    );
    if (!r.ok) {
      setErrores(r.errores);
      return;
    }
    const repetido = estado.platos.some(
      (p) =>
        p.id !== borrador.id && normalizarNombre(p.nombre) === normalizarNombre(r.valor.nombre),
    );
    if (repetido) {
      setErrores(["Ya tienes un plato con ese nombre."]);
      return;
    }
    despachar({
      tipo: "plato/guardar",
      ...(borrador.id ? { id: borrador.id } : {}),
      plato: r.valor,
    });
    setBorrador(null);
    setErrores([]);
  }

  const avisos = borrador
    ? avisosDePlato({ pasos: borrador.pasos, minutosActivos: Number(borrador.minutos) || 0 })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/menu" className="boton-suave w-fit">
          ← Volver al menú
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Mis platos <span aria-hidden="true">📖</span>
        </h1>
      </header>

      {borrador === null ? (
        <button
          type="button"
          className="boton w-fit"
          onClick={() => {
            setBorrador(vacio());
            setErrores([]);
            setIa({ cargando: false, problema: "", propuesta: null });
          }}
        >
          Nuevo plato
        </button>
      ) : (
        <form
          className="tarjeta flex flex-col gap-4"
          aria-label={borrador.id ? "Editar plato" : "Nuevo plato"}
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <h2 className="text-xl font-extrabold">{borrador.id ? "Editar plato" : "Nuevo plato"}</h2>
          <label className="flex flex-col gap-1 text-base font-semibold">
            Nombre
            <input
              className="campo"
              value={borrador.nombre}
              maxLength={120}
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
            />
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="boton-suave w-fit"
              disabled={ia.cargando || borrador.nombre.trim().length < 2}
              onClick={() => void completarConIa(borrador)}
            >
              {ia.cargando ? "Pensando…" : "✨ Completar con IA"}
            </button>
            <p className="text-tinta-suave text-sm">
              La IA propone ingredientes, tiempo y pasos a partir del nombre. Tú lo revisas antes de
              guardar. Solo se envía el nombre del plato.
            </p>
            {ia.problema && (
              <p
                role="status"
                className="bg-aviso-fondo text-aviso-texto rounded-2xl p-3 text-base"
              >
                {ia.problema}
              </p>
            )}
            {ia.propuesta && (
              <div
                role="group"
                aria-label="Propuesta de la IA"
                className="bg-suave-2 flex flex-col gap-2 rounded-2xl p-3"
              >
                <p className="text-base font-bold">
                  Propuesta de la IA ({ia.propuesta.minutos} min). Revísala: puede equivocarse.
                </p>
                <ul className="flex flex-col gap-1 text-base">
                  {ia.propuesta.filas.map((f) => (
                    <li key={f.nombre}>
                      {f.nombre} · {formatearNumero(f.cantidad)} {f.unidad}
                      {f.opcional && " (opcional)"}
                      {!f.ingredienteId && (
                        <span className="etiqueta bg-superficie ml-1">nuevo</span>
                      )}
                      {f.revisarUnidad && (
                        <span className="text-aviso-texto text-sm"> · revisa la cantidad</span>
                      )}
                    </li>
                  ))}
                </ul>
                {ia.propuesta.pasos && (
                  <p className="text-tinta-suave text-sm">{ia.propuesta.pasos}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="boton" onClick={usarPropuesta}>
                    Usar esta propuesta
                  </button>
                  <button
                    type="button"
                    className="boton-suave"
                    onClick={() => setIa({ cargando: false, problema: "", propuesta: null })}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
            <input
              type="checkbox"
              className="size-6"
              checked={borrador.ligero}
              onChange={(e) => setBorrador({ ...borrador, ligero: e.target.checked })}
            />
            Es un plato pequeño (se combina con otros en una cena)
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-base font-semibold">
              Grupo
              <select
                className="campo"
                value={borrador.grupo}
                onChange={(e) => setBorrador({ ...borrador, grupo: e.target.value as GrupoPlato })}
              >
                {GRUPOS_PLATO.map((g) => (
                  <option key={g} value={g}>
                    {NOMBRE_GRUPO[g]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-base font-semibold">
              Minutos de trabajo
              <input
                className="campo"
                inputMode="numeric"
                value={borrador.minutos}
                onChange={(e) => setBorrador({ ...borrador, minutos: e.target.value })}
              />
            </label>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-base font-semibold">Ingredientes por ración de adulto</legend>
            {borrador.filas.map((f, n) => {
              const unidad = porId.get(f.ingredienteId)?.unidad;
              return (
                <div
                  key={f.clave}
                  className="border-borde flex flex-col gap-2 rounded-2xl border p-3"
                >
                  <label className="flex flex-col gap-1 text-sm font-semibold">
                    Ingrediente {n + 1}
                    <select
                      className="campo"
                      value={f.ingredienteId}
                      onChange={(e) => cambiarFila(f.clave, { ingredienteId: e.target.value })}
                    >
                      <option value="">Elige…</option>
                      {ingredientes.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-sm font-semibold">
                      Cantidad {unidad ? `(${unidad})` : ""} {n + 1}
                      <input
                        className="campo w-32"
                        inputMode="decimal"
                        value={f.cantidad}
                        onChange={(e) => cambiarFila(f.clave, { cantidad: e.target.value })}
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-base">
                      <input
                        type="checkbox"
                        className="size-6"
                        checked={f.opcional}
                        onChange={(e) => cambiarFila(f.clave, { opcional: e.target.checked })}
                      />
                      Opcional
                    </label>
                    {borrador.filas.length > 1 && (
                      <button
                        type="button"
                        className="boton-suave"
                        aria-label={`Quitar el ingrediente ${n + 1}`}
                        onClick={() =>
                          setBorrador({
                            ...borrador,
                            filas: borrador.filas.filter((x) => x.clave !== f.clave),
                          })
                        }
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="boton-suave"
                onClick={() =>
                  setBorrador({
                    ...borrador,
                    filas: [
                      ...borrador.filas,
                      {
                        clave: Math.max(...borrador.filas.map((x) => x.clave)) + 1,
                        ingredienteId: "",
                        cantidad: "",
                        opcional: false,
                      },
                    ],
                  })
                }
              >
                Añadir ingrediente
              </button>
              <button
                type="button"
                className="boton-suave"
                onClick={() =>
                  setNuevoIng(nuevoIng ? null : { nombre: "", unidad: "g", seccion: "otros" })
                }
              >
                ¿No está? Crear ingrediente
              </button>
            </div>
          </fieldset>

          {nuevoIng && (
            <div
              className="bg-suave-2 flex flex-col gap-3 rounded-2xl p-3"
              role="group"
              aria-label="Ingrediente nuevo"
            >
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Nombre del ingrediente
                <input
                  className="campo"
                  value={nuevoIng.nombre}
                  maxLength={60}
                  onChange={(e) => setNuevoIng({ ...nuevoIng, nombre: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Se compra en
                  <select
                    className="campo"
                    value={nuevoIng.unidad}
                    onChange={(e) => setNuevoIng({ ...nuevoIng, unidad: e.target.value as Unidad })}
                  >
                    <option value="g">Gramos</option>
                    <option value="ml">Mililitros</option>
                    <option value="ud">Unidades</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Sección del súper
                  <select
                    className="campo"
                    value={nuevoIng.seccion}
                    onChange={(e) =>
                      setNuevoIng({ ...nuevoIng, seccion: e.target.value as Seccion })
                    }
                  >
                    {SECCIONES.map((s) => (
                      <option key={s} value={s}>
                        {NOMBRE_SECCION[s]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="boton w-fit"
                onClick={() => {
                  despachar({ tipo: "ingrediente/crear", ingrediente: nuevoIng });
                  setNuevoIng(null);
                }}
              >
                Guardar ingrediente
              </button>
            </div>
          )}

          <label className="flex flex-col gap-1 text-base font-semibold">
            Cómo se hace (opcional)
            <textarea
              className="campo min-h-28 py-2"
              maxLength={4000}
              value={borrador.pasos}
              onChange={(e) => setBorrador({ ...borrador, pasos: e.target.value })}
            />
          </label>

          {avisos.length > 0 && (
            <ul className="bg-aviso-fondo text-aviso-texto flex flex-col gap-1 rounded-2xl p-3 text-base">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          {errores.length > 0 && (
            <ul
              role="alert"
              className="bg-peligro-fondo text-peligro-texto flex flex-col gap-1 rounded-2xl p-3 text-base"
            >
              {errores.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="boton">
              Guardar plato
            </button>
            <button
              type="button"
              className="boton-suave"
              onClick={() => {
                setBorrador(null);
                setErrores([]);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <label htmlFor={`${id}-q`} className="sr-only">
          Buscar plato
        </label>
        <input
          id={`${id}-q`}
          className="campo max-w-xs"
          type="search"
          placeholder="Buscar plato…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label htmlFor={`${id}-g`} className="sr-only">
          Filtrar por grupo
        </label>
        <select
          id={`${id}-g`}
          className="campo max-w-48"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value as GrupoPlato | "")}
        >
          <option value="">Todos los grupos</option>
          {GRUPOS_PLATO.map((g) => (
            <option key={g} value={g}>
              {NOMBRE_GRUPO[g]}
            </option>
          ))}
        </select>
      </div>

      <p className="text-tinta-suave text-base" aria-live="polite">
        {platos.length} {platos.length === 1 ? "plato" : "platos"}
      </p>
      <div className="flex gap-2" role="group" aria-label="Cómo ver los platos">
        {VISTAS_PLATOS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={vista === v.id ? "boton" : "boton-suave"}
            aria-pressed={vista === v.id}
            onClick={() => setVista(v.id)}
          >
            {v.nombre}
          </button>
        ))}
      </div>
      {vista === "tarjetas" ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {platos.map((p) => (
            <li key={p.id} className="tarjeta flex flex-col gap-3">
              <div>
                <h2 className="text-xl font-extrabold">
                  <span aria-hidden="true">{EMOJI_GRUPO[p.grupo]} </span>
                  {p.nombre}
                </h2>
                <p className="text-tinta-suave text-base">
                  {p.minutosActivos} min · {NOMBRE_GRUPO[p.grupo]} · {p.ingredientes.length}{" "}
                  ingredientes
                  {p.valoracion !== null && ` · ★ ${formatearNumero(p.valoracion)}`}
                </p>
                {p.ingredientes.length === 0 && (
                  <p className="etiqueta bg-aviso-fondo text-aviso-texto mt-1">
                    Faltan los ingredientes: sin ellos no entra en la compra
                  </p>
                )}
                {p.porRevisar && (
                  <p className="etiqueta bg-suave-2 text-tinta mt-1">
                    Por revisar: ingredientes y tiempo estimados
                  </p>
                )}
                {p.noProponer && (
                  <p className="etiqueta bg-aviso-fondo text-aviso-texto mt-1">No se propone</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {p.ingredientes.length === 0 && (
                  <button
                    type="button"
                    className="boton"
                    aria-label={`Completar con IA: ${p.nombre}`}
                    onClick={() => {
                      const b = desdePlato(p);
                      setBorrador(b);
                      setErrores([]);
                      window.scrollTo({ top: 0 });
                      void completarConIa(b);
                    }}
                  >
                    ✨ Completar con IA
                  </button>
                )}
                <button
                  type="button"
                  className="boton-suave"
                  aria-label={`Editar ${p.nombre}`}
                  onClick={() => {
                    setBorrador(desdePlato(p));
                    setErrores([]);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="boton-suave"
                  aria-label={`${p.noProponer ? "Volver a proponer" : "No proponer"} ${p.nombre}`}
                  onClick={() =>
                    despachar({ tipo: "plato/proponer", id: p.id, proponer: !!p.noProponer })
                  }
                >
                  {p.noProponer ? "Volver a proponer" : "No proponer"}
                </button>
                {aBorrar === p.id ? (
                  <button
                    type="button"
                    className="boton"
                    aria-label={`Confirmar borrar ${p.nombre}`}
                    onClick={() => {
                      despachar({ tipo: "plato/borrar", id: p.id });
                      setABorrar(null);
                    }}
                  >
                    ¿Seguro? Borrar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="boton-suave"
                    aria-label={`Borrar ${p.nombre}`}
                    onClick={() => setABorrar(p.id)}
                  >
                    Borrar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {platos.map((p) => (
            <li key={p.id} className="tarjeta flex flex-col gap-3 !p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={abierto === p.id}
                aria-label={`${abierto === p.id ? "Cerrar" : "Abrir"} ${p.nombre}`}
                onClick={() => setAbierto(abierto === p.id ? null : p.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-lg font-extrabold">
                    <span aria-hidden="true">{EMOJI_GRUPO[p.grupo]} </span>
                    {p.nombre}
                  </span>
                  <span className="text-tinta-suave block text-base">
                    {p.minutosActivos} min · {NOMBRE_GRUPO[p.grupo]}
                    {p.valoracion !== null && ` · ★ ${formatearNumero(p.valoracion)}`}
                    {p.ingredientes.length === 0 && " · ⚠ sin ingredientes"}
                    {p.noProponer && " · no se propone"}
                  </span>
                </span>
                <span aria-hidden="true">{abierto === p.id ? "▲" : "▼"}</span>
              </button>
              {abierto === p.id && (
                <>
                  <div>
                    <p className="text-tinta-suave text-base">
                      {p.minutosActivos} min · {NOMBRE_GRUPO[p.grupo]} · {p.ingredientes.length}{" "}
                      ingredientes
                      {p.valoracion !== null && ` · ★ ${formatearNumero(p.valoracion)}`}
                    </p>
                    {p.ingredientes.length === 0 && (
                      <p className="etiqueta bg-aviso-fondo text-aviso-texto mt-1">
                        Faltan los ingredientes: sin ellos no entra en la compra
                      </p>
                    )}
                    {p.porRevisar && (
                      <p className="etiqueta bg-suave-2 text-tinta mt-1">
                        Por revisar: ingredientes y tiempo estimados
                      </p>
                    )}
                    {p.noProponer && (
                      <p className="etiqueta bg-aviso-fondo text-aviso-texto mt-1">No se propone</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.ingredientes.length === 0 && (
                      <button
                        type="button"
                        className="boton"
                        aria-label={`Completar con IA: ${p.nombre}`}
                        onClick={() => {
                          const b = desdePlato(p);
                          setBorrador(b);
                          setErrores([]);
                          window.scrollTo({ top: 0 });
                          void completarConIa(b);
                        }}
                      >
                        ✨ Completar con IA
                      </button>
                    )}
                    <button
                      type="button"
                      className="boton-suave"
                      aria-label={`Editar ${p.nombre}`}
                      onClick={() => {
                        setBorrador(desdePlato(p));
                        setErrores([]);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="boton-suave"
                      aria-label={`${p.noProponer ? "Volver a proponer" : "No proponer"} ${p.nombre}`}
                      onClick={() =>
                        despachar({ tipo: "plato/proponer", id: p.id, proponer: !!p.noProponer })
                      }
                    >
                      {p.noProponer ? "Volver a proponer" : "No proponer"}
                    </button>
                    {aBorrar === p.id ? (
                      <button
                        type="button"
                        className="boton"
                        aria-label={`Confirmar borrar ${p.nombre}`}
                        onClick={() => {
                          despachar({ tipo: "plato/borrar", id: p.id });
                          setABorrar(null);
                        }}
                      >
                        ¿Seguro? Borrar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="boton-suave"
                        aria-label={`Borrar ${p.nombre}`}
                        onClick={() => setABorrar(p.id)}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
