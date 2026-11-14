"use client";

import { useEffect, useState } from "react";
import { sumarDias } from "@/dominio/fechas";
import { useCuenta, useHogar } from "./proveedor-hogar";
import { useNotificaciones } from "./usar-notificaciones";

const CLAVE = "menus-semanales:avisos-luego";

/**
 * El recordatorio de activar las notificaciones en este móvil (D-150): sale en «Hoy» solo si este
 * móvil podría tenerlas y aún no las tiene. «Ahora no» lo esconde una semana. Con ellas activas,
 * bloqueadas o sin cuenta, no ocupa sitio.
 */
export function ActivarAvisosHoy() {
  const { fase, hogar } = useCuenta();
  const { estado: hogarEstado } = useHogar();
  const { estado, mensaje, ocupado, activar } = useNotificaciones();
  const [luegoHasta, setLuegoHasta] = useState<string | null>(null);
  const [leido, setLeido] = useState(false);

  useEffect(() => {
    let valor: string | null = null;
    try {
      valor = window.localStorage.getItem(CLAVE);
    } catch {
      // Sin almacenamiento, sale siempre: es solo un recordatorio.
    }
    void Promise.resolve().then(() => {
      setLuegoHasta(valor);
      setLeido(true);
    });
  }, []);

  const hoy = hogarEstado.hoy;
  if (!leido || fase !== "conectado" || !hogar) return null;
  if (estado === "activas" && mensaje) {
    return (
      <p role="status" className="bg-ok-fondo text-ok-texto rounded-2xl p-3 text-base">
        ✅ {mensaje}
      </p>
    );
  }
  if (estado !== "inactivas" && estado !== "ios-sin-instalar") return null;
  if (luegoHasta && luegoHasta > hoy) return null;

  const ahoraNo = () => {
    const hasta = sumarDias(hoy, 7);
    try {
      window.localStorage.setItem(CLAVE, hasta);
    } catch {
      // Si no se puede guardar, se esconde solo esta vez.
    }
    setLuegoHasta(hasta);
  };

  return (
    <section aria-labelledby="activar-avisos" className="tarjeta flex flex-col gap-2">
      <h2 id="activar-avisos" className="text-lg font-bold">
        <span aria-hidden="true">📲 </span>Activa los avisos en este móvil
      </h2>
      <p className="text-base">
        El paraguas a las 7 si llueve camino del cole, lo de la mochila a las 20 y lo de cada día a
        las 9. Aunque la app esté cerrada.
      </p>
      {estado === "ios-sin-instalar" ? (
        <p className="bg-suave-1 rounded-2xl p-3 text-base">
          En el iPhone hace falta la app instalada: en Safari, Compartir → «Añadir a pantalla de
          inicio», y ábrela desde el icono.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {estado === "inactivas" && (
          <button type="button" className="boton" disabled={ocupado} onClick={() => void activar()}>
            Activar
          </button>
        )}
        <button type="button" className="boton-suave" onClick={ahoraNo}>
          Ahora no
        </button>
      </div>
      {mensaje && (
        <p role="status" className="text-base">
          {mensaje}
        </p>
      )}
    </section>
  );
}
