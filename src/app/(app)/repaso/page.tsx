import type { Metadata } from "next";
import { RepasoVista } from "@/componentes/vistas/repaso-vista";

export const metadata: Metadata = { title: "Revisión de la semana" };

export default function PaginaRepaso() {
  return <RepasoVista />;
}
