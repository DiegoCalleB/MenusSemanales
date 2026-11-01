import type { Metadata } from "next";
import { CompraVista } from "@/componentes/vistas/compra-vista";

export const metadata: Metadata = { title: "Compra" };

export default function PaginaCompra() {
  return <CompraVista />;
}
