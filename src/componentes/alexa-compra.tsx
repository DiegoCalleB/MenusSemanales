"use client";

import { useEffect, useRef } from "react";
import { z } from "zod";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import { recogerCompraAlexa } from "@/infraestructura/supabase/cuenta";
import { useCuenta, useHogar } from "./proveedor-hogar";

const textos = z.array(z.string().min(1).max(80)).max(60);

/**
 * Alexa → la lista de la compra (D-214). No pinta nada. Al abrir la app y al volver a ella, recoge lo
 * que se ha pedido a Alexa («añade leche») y lo añade a la lista. La base de datos entrega cada
 * producto a un solo móvil, así que no se duplica aunque haya dos abiertos. Solo con cuenta.
 */
export function AlexaCompra() {
  const { fase, hogar } = useCuenta();
  const { despachar } = useHogar();
  const ocupado = useRef(false);

  useEffect(() => {
    if (fase !== "conectado" || !hogar) return;
    const hogarId = hogar.id;
    async function recoger() {
      if (ocupado.current || document.visibilityState === "hidden") return;
      ocupado.current = true;
      try {
        const r = await recogerCompraAlexa(crearClienteNavegador(), hogarId);
        const lista = textos.safeParse(r.data);
        if (r.error || !lista.success) return;
        for (const nombre of lista.data) despachar({ tipo: "manual/anadir", nombre });
      } catch {
        // Sin red: se recoge la próxima vez.
      } finally {
        ocupado.current = false;
      }
    }
    void Promise.resolve().then(recoger);
    const alVolver = () => void recoger();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [fase, hogar, despachar]);

  return null;
}
