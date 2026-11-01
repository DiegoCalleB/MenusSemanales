"use client";

import Link from "next/link";
import { EMOJI_GRUPO } from "../formato";
import { IconoCompra, IconoDespensa, IconoMenu, IconoReparto } from "../iconos";
import { useHogar } from "../proveedor-hogar";

const MODULOS = [
  {
    href: "/menu",
    titulo: "Menú de la semana",
    texto: "Varias opciones para cada cena, pensadas para el tiempo que tenéis y el menú del cole.",
    Icono: IconoMenu,
    fondo: "bg-suave-1",
  },
  {
    href: "/compra",
    titulo: "Lista de la compra",
    texto: "Se calcula sola con lo que habéis elegido cenar. Marcadla en el súper, entre los dos.",
    Icono: IconoCompra,
    fondo: "bg-suave-2",
  },
  {
    href: "/despensa",
    titulo: "Despensa y nevera",
    texto: "Qué hay, qué caduca pronto y qué se descuenta al cocinar. Todo se puede deshacer.",
    Icono: IconoDespensa,
    fondo: "bg-suave-3",
  },
  {
    href: "/reparto",
    titulo: "Reparto de la semana",
    texto: "Quién se encarga de qué, contando también lo que no se ve: acordarse y organizar.",
    Icono: IconoReparto,
    fondo: "bg-suave-1",
  },
] as const;

export function InicioVista() {
  const { estado } = useHogar();
  const cena = estado.comidas.find((c) => c.fecha === estado.hoy);

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="hoy"
        className="from-suave-1 to-suave-2 border-borde flex flex-col gap-4 rounded-[2rem] border bg-linear-to-br p-6 sm:p-8"
      >
        <p className="text-tinta-suave text-lg font-semibold">¡Hola! 👋</p>
        <h1 id="hoy" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {cena ? "Hoy cenáis…" : "¿Qué cenamos hoy?"}
        </h1>
        {cena ? (
          <p className="flex items-center gap-3 text-2xl font-bold">
            <span aria-hidden="true" className="text-4xl">
              {EMOJI_GRUPO[(cena.plato as { grupo?: string }).grupo ?? "otro"] ?? "🍽️"}
            </span>
            {cena.plato.nombre}
          </p>
        ) : (
          <p className="text-tinta-suave max-w-prose text-lg">
            Aún no hay cena elegida. Mira las opciones: ya tienen en cuenta el tiempo que tenéis y
            lo que han comido las niñas en el cole.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href="/menu" className="boton">
            {cena ? "Ver el menú" : "Elegir la cena"}
          </Link>
          <Link href="/menu/emergencia" className="boton-suave">
            Hoy llego tarde
          </Link>
          <Link href="/compra" className="boton-suave">
            Lista de la compra
          </Link>
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULOS.map(({ href, titulo, texto, Icono, fondo }) => (
          <li key={href}>
            <Link
              href={href}
              className="tarjeta hover:border-marca/40 flex h-full flex-col gap-3 transition-colors"
            >
              <span
                className={`${fondo} text-marca flex size-12 items-center justify-center rounded-2xl`}
              >
                <Icono width={26} height={26} />
              </span>
              <span className="text-xl font-bold">{titulo}</span>
              <span className="text-tinta-suave text-base">{texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
