import type { Metadata } from "next";
import { FechasVista } from "@/componentes/vistas/fechas-vista";

export const metadata: Metadata = { title: "Próximas fechas" };

export default function PaginaFechas() {
  return <FechasVista />;
}
