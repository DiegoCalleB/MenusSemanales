import type { Metadata } from "next";
import { CalendarioVista } from "@/componentes/vistas/calendario-vista";

export const metadata: Metadata = { title: "Calendario" };

export default function PaginaCalendario() {
  return <CalendarioVista />;
}
