import type { Metadata } from "next";
import { ColeVista } from "@/componentes/vistas/cole-vista";

export const metadata: Metadata = { title: "Menú del cole" };

export default function PaginaCole() {
  return <ColeVista />;
}
