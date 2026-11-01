import type { Metadata } from "next";
import { RegaloVista } from "@/componentes/vistas/regalo-vista";

export const metadata: Metadata = { title: "Un regalo" };

export default function PaginaRegalo() {
  return <RegaloVista />;
}
