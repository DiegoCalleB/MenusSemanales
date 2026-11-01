import type { Metadata } from "next";
import { PlatosVista } from "@/componentes/vistas/platos-vista";

export const metadata: Metadata = { title: "Mis platos" };

export default function PaginaPlatos() {
  return <PlatosVista />;
}
