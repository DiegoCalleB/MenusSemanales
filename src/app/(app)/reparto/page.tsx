import type { Metadata } from "next";
import { RepartoVista } from "@/componentes/vistas/reparto-vista";

export const metadata: Metadata = { title: "Reparto" };

export default function PaginaReparto() {
  return <RepartoVista />;
}
