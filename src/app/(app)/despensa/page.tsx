import type { Metadata } from "next";
import { DespensaVista } from "@/componentes/vistas/despensa-vista";

export const metadata: Metadata = { title: "Despensa" };

export default function PaginaDespensa() {
  return <DespensaVista />;
}
