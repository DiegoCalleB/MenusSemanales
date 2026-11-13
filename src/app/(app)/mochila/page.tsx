import type { Metadata } from "next";
import { MochilaVista } from "@/componentes/vistas/mochila-vista";

export const metadata: Metadata = { title: "Qué llevar" };

export default function PaginaMochila() {
  return <MochilaVista />;
}
