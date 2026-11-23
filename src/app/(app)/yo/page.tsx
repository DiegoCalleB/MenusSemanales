import type { Metadata } from "next";
import { YoVista } from "@/componentes/vistas/yo-vista";

export const metadata: Metadata = { title: "Yo" };

export default function PaginaYo() {
  return <YoVista />;
}
