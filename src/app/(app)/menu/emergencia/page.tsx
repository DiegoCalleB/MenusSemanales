import type { Metadata } from "next";
import { EmergenciaVista } from "@/componentes/vistas/emergencia-vista";

export const metadata: Metadata = { title: "Cena de emergencia" };

export default function PaginaEmergencia() {
  return <EmergenciaVista />;
}
