"use client";

import Link from "next/link";
import { EMOJI_GRUPO } from "../formato";
import { IconoCompra, IconoDespensa, IconoMenu, IconoReparto } from "../iconos";
import { proximoDiaConCole } from "@/aplicacion/estado";
import { diasEntre } from "@/dominio/fechas";
import { TarjetaCole, fechaCorta } from "../cole";
import { MODO_DATOS, useHogar } from "../proveedor-hogar";

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
  const proximo = Object.entries(estado.eventos)
    .filter(([f]) => f >= estado.hoy && diasEntre(estado.hoy, f) <= 14)
    .sort(([a], [b]) => a.localeCompare(b))[0];
  const faltan = proximo ? diasEntre(estado.hoy, proximo[0]) : 0;
  const diaCole = proximoDiaConCole(estado, estado.hoy);

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="hoy"
        className="from-suave-1 to-suave-2 border-borde flex flex-col gap-4 rounded-[2rem] border bg-linear-to-br p-6 sm:p-8"
      >
        <p className="text-tinta-suave text-lg font-semibold">
          {MODO_DATOS === "diego" ? "¡Hola, Diego! 👋" : "¡Hola! 👋"}
        </p>
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
        {proximo && (
          <p className="bg-superficie/80 w-fit rounded-full px-4 py-2 text-base font-bold">
            <span aria-hidden="true">{proximo[1].emoji} </span>
            {proximo[1].titulo} ·{" "}
            {faltan === 0 ? "¡hoy!" : faltan === 1 ? "mañana" : `en ${faltan} días`}
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

      {diaCole && (
        <section aria-labelledby="cole-hoy" className="flex flex-col gap-2">
          <h2 id="cole-hoy" className="text-xl font-extrabold">
            {diaCole === estado.hoy
              ? "Hoy en el cole"
              : `Próximo menú del cole · ${fechaCorta(diaCole)}`}
          </h2>
          <TarjetaCole cole={estado.colegio[diaCole] ?? null} fecha={diaCole} />
        </section>
      )}

      {MODO_DATOS === "diego" && (
        <Link
          href="/regalo"
          className="tarjeta hover:border-marca/40 flex items-center gap-3 transition-colors"
        >
          <span aria-hidden="true" className="text-3xl">
            🎁
          </span>
          <span>
            <span className="block text-lg font-extrabold">Preparar un regalo con la app</span>
            <span className="text-tinta-suave block text-base">
              Escribe un mensaje y comparte el enlace.
            </span>
          </span>
        </Link>
      )}

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
