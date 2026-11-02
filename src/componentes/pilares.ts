import type { ComponentType, SVGProps } from "react";
import { IconoAgenda, IconoCasa, IconoHoy, IconoMenu, IconoOpciones } from "./iconos";

/**
 * La estructura de la app en cuatro pilares más «Más» (D-081, plan de reorganización): cada uno
 * responde a una pregunta y agrupa las pantallas que ya existían. Las URL no cambian.
 */
export interface Pestana {
  href: string;
  texto: string;
}
export interface Pilar {
  id: "hoy" | "comer" | "casa" | "fechas" | "mas";
  texto: string;
  /** Adónde lleva el botón del pilar. */
  href: string;
  Icono: ComponentType<SVGProps<SVGSVGElement>>;
  /** Pantallas del pilar (vacío: no lleva pestañas). */
  pestanas: readonly Pestana[];
}

export const PILARES: readonly Pilar[] = [
  { id: "hoy", texto: "Hoy", href: "/", Icono: IconoHoy, pestanas: [] },
  {
    id: "comer",
    texto: "Comer",
    href: "/menu",
    Icono: IconoMenu,
    pestanas: [
      { href: "/menu", texto: "Cena" },
      { href: "/menu/cole", texto: "Cole" },
      { href: "/compra", texto: "Compra" },
      { href: "/despensa", texto: "Despensa" },
      { href: "/menu/platos", texto: "Platos" },
      { href: "/menu/emergencia", texto: "Llego tarde" },
    ],
  },
  {
    id: "casa",
    texto: "Casa",
    href: "/casa",
    Icono: IconoCasa,
    pestanas: [
      { href: "/casa", texto: "Recurrente" },
      { href: "/tareas", texto: "Por persona" },
      { href: "/reparto", texto: "Reparto" },
    ],
  },
  {
    id: "fechas",
    texto: "Fechas",
    href: "/fechas",
    Icono: IconoAgenda,
    pestanas: [
      { href: "/fechas", texto: "Próximas" },
      { href: "/calendario", texto: "Calendario" },
      { href: "/cumples", texto: "Cumples" },
    ],
  },
  {
    id: "mas",
    texto: "Más",
    href: "/cuenta",
    Icono: IconoOpciones,
    pestanas: [
      { href: "/cuenta", texto: "Cuenta" },
      { href: "/compartir", texto: "Enviar" },
    ],
  },
];

const coincide = (ruta: string, href: string) =>
  href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);

/** A qué pilar pertenece una ruta (la portada es «Hoy»). */
export function pilarDe(ruta: string): Pilar | null {
  if (ruta === "/") return PILARES[0] ?? null;
  return PILARES.find((p) => p.pestanas.some((t) => coincide(ruta, t.href))) ?? null;
}

/** La pestaña que está abierta: la de ruta más específica (/menu/cole gana a /menu). */
export function pestanaActiva(pilar: Pilar, ruta: string): Pestana | null {
  return (
    pilar.pestanas
      .filter((t) => coincide(ruta, t.href))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  );
}
