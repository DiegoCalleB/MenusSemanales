import type { Metadata } from "next";
import { ObjetivosVista } from "@/componentes/vistas/objetivos-vista";

export const metadata: Metadata = { title: "Objetivos" };

export default function PaginaObjetivos() {
  return <ObjetivosVista />;
}
