import type { Metadata } from "next";
import { SemanaVista } from "@/componentes/vistas/semana-vista";

export const metadata: Metadata = { title: "Plan de la semana" };

export default function PaginaSemana() {
  return <SemanaVista />;
}
