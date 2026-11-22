import type { Metadata } from "next";
import { AvisosVista } from "@/componentes/vistas/avisos-vista";

export const metadata: Metadata = { title: "Avisos" };

export default function PaginaAvisos() {
  return <AvisosVista />;
}
