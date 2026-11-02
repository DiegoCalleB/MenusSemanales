import type { Metadata } from "next";
import { TareasVista } from "@/componentes/vistas/tareas-vista";

export const metadata: Metadata = { title: "Día de zafarrancho" };

export default function PaginaTareas() {
  return <TareasVista />;
}
