import type { ReactNode } from "react";
import { BannerPrueba } from "@/componentes/banner-prueba";
import { AnadirRapido } from "@/componentes/anadir-rapido";
import { AvisoGlobal } from "@/componentes/aviso";
import { BotonAvisos } from "@/componentes/avisos-campana";
import { NavegacionInferior, NavegacionLateral, Pestanas } from "@/componentes/navegacion";
import { BotonTema, ProveedorTema } from "@/componentes/tema";
import { BotonPerfil, PuertaDePerfil } from "@/componentes/perfiles";
import { BienvenidaAna } from "@/componentes/bienvenida-ana";
import { BienvenidaCumple } from "@/componentes/bienvenida-cumple";
import { LimpiarFechas } from "@/componentes/limpiar-fechas";
import { ProveedorHogar } from "@/componentes/proveedor-hogar";

/**
 * Estructura común y responsive:
 *   móvil     cabecera pequeña + barra de pestañas fija abajo
 *   ≥ 768 px  barra lateral y contenido a su derecha
 * El estado del hogar vive aquí para conservarse al cambiar de pantalla.
 */
export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <ProveedorTema>
      <ProveedorHogar>
        <a
          href="#contenido"
          className="focus:bg-marca focus:text-sobre-marca sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:px-4 focus:py-3"
        >
          Saltar al contenido
        </a>
        <PuertaDePerfil>
          <div className="min-h-dvh md:flex">
            <NavegacionLateral />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="border-borde bg-superficie/95 sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 backdrop-blur md:hidden">
                <span
                  aria-hidden="true"
                  className="bg-suave-1 flex size-9 items-center justify-center rounded-xl text-xl"
                >
                  ✅
                </span>
                <span className="text-marca hidden flex-1 text-lg font-extrabold tracking-tight min-[430px]:block">
                  ¡Hecho!
                </span>
                <span className="flex-1 min-[430px]:hidden" />
                <BotonAvisos />
                <BotonPerfil />
                <BotonTema />
              </header>
              <BannerPrueba />
              <main
                id="contenido"
                className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-32 md:px-8 md:pt-8 md:pb-12"
              >
                <Pestanas />
                {children}
              </main>
            </div>
          </div>
          <NavegacionInferior />
          <AnadirRapido />
          <AvisoGlobal />
          <BienvenidaCumple />
          <BienvenidaAna />
          <LimpiarFechas />
        </PuertaDePerfil>
      </ProveedorHogar>
    </ProveedorTema>
  );
}
