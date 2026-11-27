"use client";

import { useEffect, useRef } from "react";
import { z } from "zod";
import { type Entrada, entradaSchema, reducirEntradas, textoDeCita } from "@/dominio/conchi";
import { claveArticulo } from "@/dominio/habituales";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import { recogerEntradasAlexa } from "@/infraestructura/supabase/cuenta";
import { useCuenta, useHogar } from "./proveedor-hogar";

const entradas = z.array(entradaSchema).max(80);

/**
 * Conchi (Alexa) → la app (D-214, D-215). No pinta nada. Al abrir la app y al volver a ella, recoge
 * lo que se ha pedido por voz y lo guarda donde toca: la compra en la lista, los pendientes en
 * pendientes, las citas (ya confirmadas en voz alta) en fechas, y las tareas de casa hechas, marcadas.
 * La base de datos entrega cada cosa a un solo móvil, así que no se duplica. Solo con cuenta.
 */
export function AlexaEntradas() {
  const { fase, hogar } = useCuenta();
  const { estado, despachar } = useHogar();
  const ocupado = useRef(false);
  const ultimo = useRef(estado);
  useEffect(() => {
    ultimo.current = estado;
  }, [estado]);

  useEffect(() => {
    if (fase !== "conectado" || !hogar) return;
    const hogarId = hogar.id;

    function aplicar(e: Entrada) {
      switch (e.tipo) {
        case "compra":
          despachar({ tipo: "manual/anadir", nombre: e.texto });
          return;
        case "pendiente":
          despachar({
            tipo: "pendiente/anadir",
            texto: e.texto,
            personaId: null,
            importante: false,
          });
          return;
        case "cita":
          if (e.fecha) {
            despachar({
              tipo: "agenda/anadir",
              texto: textoDeCita(e.fecha, e.hora, e.texto),
              personaId: null,
            });
          }
          return;
        case "hecha": {
          const buscada = claveArticulo(e.texto);
          const tarea = ultimo.current.casa.find((t) => claveArticulo(t.titulo) === buscada);
          if (tarea) despachar({ tipo: "casa/hecha", id: tarea.id });
          return;
        }
        // Quitar (D-216): «borra lo último», «quita la leche de la compra».
        case "quitar_compra": {
          const buscada = claveArticulo(e.texto);
          const item = ultimo.current.manuales.find(
            (m) => !m.comprado && claveArticulo(m.nombre) === buscada,
          );
          if (item) despachar({ tipo: "manual/borrar", id: item.id });
          return;
        }
        case "quitar_pendiente": {
          const buscada = claveArticulo(e.texto);
          const item = ultimo.current.pendientes.find(
            (x) => !x.hechoEn && claveArticulo(x.texto) === buscada,
          );
          if (item) despachar({ tipo: "pendiente/borrar", id: item.id });
          return;
        }
        case "quitar_cita": {
          const buscada = claveArticulo(e.texto);
          const item = ultimo.current.agenda.find(
            (a) => a.fecha === e.fecha && claveArticulo(a.titulo) === buscada,
          );
          if (item) despachar({ tipo: "agenda/borrar", id: item.id });
        }
      }
    }

    async function recoger() {
      if (ocupado.current || document.visibilityState === "hidden") return;
      ocupado.current = true;
      try {
        const r = await recogerEntradasAlexa(crearClienteNavegador(), hogarId);
        const lista = entradas.safeParse(r.data);
        if (r.error || !lista.success) return;
        for (const e of reducirEntradas(lista.data)) aplicar(e);
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
