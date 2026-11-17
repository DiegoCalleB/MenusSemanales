import type { Metadata } from "next";
import { PendientesVista } from "@/componentes/vistas/pendientes-vista";

export const metadata: Metadata = { title: "Pendientes" };

export default function PaginaPendientes() {
  return <PendientesVista />;
}
