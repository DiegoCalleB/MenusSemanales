import type { Metadata } from "next";
import { Suspense } from "react";
import { CompartidoVista } from "@/componentes/vistas/compartido-vista";

export const metadata: Metadata = { title: "Compartido" };

export default function PaginaCompartido() {
  return (
    <Suspense>
      <CompartidoVista />
    </Suspense>
  );
}
