import type { Metadata } from "next";
import { CumplesVista } from "@/componentes/vistas/cumples-vista";

export const metadata: Metadata = { title: "Cumples y regalos" };

export default function PaginaCumples() {
  return <CumplesVista />;
}
