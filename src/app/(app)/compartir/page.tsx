import type { Metadata } from "next";
import { CompartirVista } from "@/componentes/vistas/compartir-vista";

export const metadata: Metadata = { title: "Enviar" };

export default function PaginaCompartir() {
  return <CompartirVista />;
}
