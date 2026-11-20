import type { Metadata } from "next";
import { NotasVista } from "@/componentes/vistas/notas-vista";

export const metadata: Metadata = { title: "Notas e ideas" };

export default function PaginaNotas() {
  return <NotasVista />;
}
