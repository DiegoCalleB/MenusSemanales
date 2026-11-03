"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { articulosPendientes } from "@/aplicacion/estado";
import { useCuenta, useHogar } from "./proveedor-hogar";
import { NUBE_DISPONIBLE } from "./usar-nube";
import { BotonPerfil } from "./perfiles";
import { BotonTema } from "./tema";
import { PILARES, pestanaActiva, pilarDe } from "./pilares";

/** Cuántas cosas faltan por comprar (lo calculado y lo apuntado a mano): para acordarse al verlo. */
function usePendientesDeCompra(): number {
  const { estado } = useHogar();
  return articulosPendientes(estado).length + estado.manuales.filter((m) => !m.comprado).length;
}

function Contador({ n, flotante = false }: { n: number; flotante?: boolean }) {
  if (n <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className={`bg-marca text-sobre-marca inline-flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${flotante ? "absolute -top-1 right-0" : "ml-1"}`}
      >
        {n > 99 ? "99+" : n}
      </span>
      <span className="sr-only"> ({n} pendientes)</span>
    </>
  );
}

/** Móvil: barra de pestañas fija abajo, al alcance del pulgar y respetando la zona segura del iPhone. */
export function NavegacionInferior() {
  const ruta = usePathname();
  const pendientes = usePendientesDeCompra();
  const actual = pilarDe(ruta)?.id;
  return (
    <nav
      aria-label="Principal"
      className="border-borde bg-superficie fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {PILARES.map(({ id, href, texto, Icono }) => {
          const esActivo = actual === id;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={esActivo ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-0.5 text-xs leading-tight ${
                  esActivo ? "text-marca font-bold" : "text-tinta-suave font-medium"
                }`}
              >
                <span
                  className={`relative flex h-8 w-14 items-center justify-center rounded-full ${esActivo ? "bg-suave-1" : ""}`}
                >
                  <Icono />
                  {id === "comer" && actual !== "comer" && <Contador n={pendientes} flotante />}
                </span>
                {texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tablet y escritorio: barra lateral con el nombre de la app y las secciones. */
export function NavegacionLateral() {
  const ruta = usePathname();
  const pendientes = usePendientesDeCompra();
  const actual = pilarDe(ruta)?.id;
  return (
    <aside className="border-borde bg-superficie sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-6 border-r p-4 md:flex lg:w-64">
      <Link
        href="/"
        className="mt-2 flex items-center gap-3 px-2 text-xl font-extrabold tracking-tight"
      >
        <span
          aria-hidden="true"
          className="bg-suave-1 flex size-10 items-center justify-center rounded-2xl text-2xl"
        >
          🍽️
        </span>
        <span className="text-marca">Menús Semanales</span>
      </Link>
      <nav aria-label="Principal">
        <ul className="flex flex-col gap-1">
          {PILARES.map(({ id, href, texto, Icono }) => {
            const esActivo = actual === id;
            return (
              <li key={id}>
                <Link
                  href={href}
                  aria-current={esActivo ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-base ${
                    esActivo
                      ? "bg-suave-1 text-marca-fuerte font-bold"
                      : "text-tinta hover:bg-fondo font-medium"
                  }`}
                >
                  <Icono />
                  {texto}
                  {id === "comer" && actual !== "comer" && <Contador n={pendientes} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col items-start gap-2 px-2">
        <BotonPerfil />
        <BotonTema />
      </div>
      <EstadoDeGuardado />
    </aside>
  );
}

/**
 * Las pantallas del pilar abierto, en una fila de pestañas pegada arriba (con desplazamiento
 * lateral si no caben). La portada no lleva. Sirve igual en móvil y en escritorio.
 */
export function Pestanas() {
  const ruta = usePathname();
  const pendientes = usePendientesDeCompra();
  const pilar = pilarDe(ruta);
  if (!pilar || pilar.pestanas.length === 0) return null;
  const activa = pestanaActiva(pilar, ruta);
  return (
    <nav aria-label="Apartados" className="-mx-4 mb-4 md:mx-0">
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1 md:flex-wrap md:overflow-visible md:px-0">
        {pilar.pestanas.map((t) => {
          const esActiva = activa?.href === t.href;
          return (
            <li key={t.href} className="shrink-0">
              <Link
                href={t.href}
                aria-current={esActiva ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-full border px-4 text-base whitespace-nowrap ${
                  esActiva
                    ? "bg-suave-1 border-marca text-marca-fuerte font-bold"
                    : "border-borde bg-superficie text-tinta font-medium"
                }`}
              >
                {t.texto}
                {t.href === "/compra" && <Contador n={pendientes} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Dónde se guardan los datos, dicho con la verdad (D-102): antes era un texto fijo. */
function EstadoDeGuardado() {
  const cuenta = useCuenta();
  const conectado = cuenta.fase === "conectado";
  return (
    <p className="text-tinta-suave px-2 text-sm">
      {conectado
        ? `☁️ Guardado en la nube (${cuenta.hogar?.nombre ?? "tu hogar"}).`
        : NUBE_DISPONIBLE
          ? "⚠️ Sin guardar en la nube."
          : "Solo en este dispositivo."}
    </p>
  );
}
