import type { Metadata } from "next";
import { CuentaVista } from "@/componentes/vistas/cuenta-vista";

export const metadata: Metadata = { title: "Cuenta" };

export default function PaginaCuenta() {
  return <CuentaVista />;
}
