import type { Metadata } from "next";
import { PapelesVista } from "@/componentes/vistas/papeles-vista";

export const metadata: Metadata = { title: "Papeles y vencimientos" };

export default function PaginaPapeles() {
  return <PapelesVista />;
}
