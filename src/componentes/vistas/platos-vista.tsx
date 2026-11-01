"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { avisosDePlato, normalizarNombre, validarPlato } from "@/dominio/catalogo";
import { GRUPOS_PLATO, type GrupoPlato, type PlatoMenu } from "@/dominio/menu";
import { SECCIONES, type Seccion, type Unidad } from "@/dominio/tipos";
import { EMOJI_GRUPO, NOMBRE_SECCION, formatearNumero } from "../formato";
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
}
interface Borrador {
  id?: string;
  nombre: string;
  grupo: GrupoPlato;
  minutos: string;
  pasos: string;
  filas: FilaIngrediente[];
}

const vacio = (): Borrador => ({
  nombre: "",
  grupo: "otro",
  minutos: "20",
  pasos: "",
  filas: [{ clave: 0, ingredienteId: "", cantidad: "", opcional: false }],
});

function desdePlato(p: PlatoMenu): Borrador {
  return {
    id: p.id,
    nombre: p.nombre,
    grupo: p.grupo,
    minutos: String(p.minutosActivos),
    pasos: p.pasos ?? "",
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
  const [nuevoIng, setNuevoIng] = useState<{
    nombre: string;
    unidad: Unidad;
    seccion: Seccion;
  } | null>(null);
  const id = useId();

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
    </div>
  );
}
