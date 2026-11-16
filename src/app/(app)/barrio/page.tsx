import type { Metadata } from "next";
import { BarrioVista } from "@/componentes/vistas/barrio-vista";

export const metadata: Metadata = { title: "Planes del barrio" };

export default function PaginaBarrio() {
  return <BarrioVista />;
}
