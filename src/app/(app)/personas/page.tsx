import type { Metadata } from "next";
import { PersonasVista } from "@/componentes/vistas/personas-vista";

export const metadata: Metadata = { title: "Familia" };

export default function PaginaPersonas() {
  return <PersonasVista />;
}
