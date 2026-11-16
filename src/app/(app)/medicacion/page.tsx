import type { Metadata } from "next";
import { MedicacionVista } from "@/componentes/vistas/medicacion-vista";

export const metadata: Metadata = { title: "Medicación" };

export default function PaginaMedicacion() {
  return <MedicacionVista />;
}
