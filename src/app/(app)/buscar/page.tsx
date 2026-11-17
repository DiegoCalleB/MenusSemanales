import type { Metadata } from "next";
import { BuscarVista } from "@/componentes/vistas/buscar-vista";

export const metadata: Metadata = { title: "Buscar" };

export default function PaginaBuscar() {
  return <BuscarVista />;
}
