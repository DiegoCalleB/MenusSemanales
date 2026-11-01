import type { Metadata } from "next";
import { MenuVista } from "@/componentes/vistas/menu-vista";

export const metadata: Metadata = { title: "Menú" };

export default function PaginaMenu() {
  return <MenuVista />;
}
