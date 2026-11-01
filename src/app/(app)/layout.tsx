import type { ReactNode } from "react";
import { AvisoGlobal } from "@/componentes/aviso";
import { NavegacionInferior, NavegacionLateral } from "@/componentes/navegacion";
import { ProveedorHogar } from "@/componentes/proveedor-hogar";

/**
 * Estructura común y responsive:
 *   móvil     cabecera pequeña + barra de pestañas fija abajo
 *   ≥ 768 px  barra lateral y contenido a su derecha
 * El estado del hogar vive aquí para conservarse al cambiar de pantalla.
 */
export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <ProveedorHogar>
      <a
        href="#contenido"
        className="focus:bg-marca focus:text-sobre-marca sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:px-4 focus:py-3"
      >
        Saltar al contenido
      </a>
      <div className="min-h-dvh md:flex">
        <NavegacionLateral />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-borde bg-superficie/95 sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur md:hidden">
            <span className="text-marca text-lg font-semibold tracking-tight">Menús Semanales</span>
            <span className="etiqueta bg-aviso-fondo text-aviso-texto">Demo</span>
          </header>
          <main
            id="contenido"
            className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-32 md:px-8 md:pt-8 md:pb-12"
          >
            {children}
          </main>
        </div>
      </div>
      <NavegacionInferior />
      <AvisoGlobal />
    </ProveedorHogar>
  );
}
