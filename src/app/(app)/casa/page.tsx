import type { Metadata } from "next";
import { CasaVista } from "@/componentes/vistas/casa-vista";

export const metadata: Metadata = { title: "Casa" };

export default function PaginaCasa() {
  return <CasaVista />;
}
