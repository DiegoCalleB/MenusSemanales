"use client";

import { useState } from "react";
import { enlaceDeApp } from "@/aplicacion/enlaces";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import { enlaceDelCalendario } from "@/infraestructura/supabase/cuenta";
import { useCuenta, useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

/**
 * Avisos fuera de la app (D-083): el calendario del móvil se suscribe a un enlace de la app y
 * muestra las tareas, las fechas y los cumpleaños con alarma, aunque la app esté cerrada. El enlace
 * es de la persona que tiene este perfil abierto (para sus tareas y para no avisarle de su regalo).
 */
export function AvisosCalendario() {
  const { fase, hogar } = useCuenta();
  const { estado } = useHogar();
  const [yo] = useYo();
  const persona = estado.personas.find((p) => p.id === yo && p.activa);
  const [token, setToken] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const enlace =
    token && persona
      ? enlaceDeApp(`/api/calendario/${token}.ics?para=${encodeURIComponent(persona.id)}`)
      : null;
  const webcal = enlace?.replace(/^https?:/, "webcal:") ?? null;
  // Las comidas y cenas van en un calendario aparte (D-140).
  const enlaceComidas = enlace ? `${enlace}&solo=comidas` : null;
  const webcalComidas = enlaceComidas?.replace(/^https?:/, "webcal:") ?? null;

  async function pedir(renovar: boolean) {
    if (!hogar) return;
    setOcupado(true);
    setMensaje("");
    try {
      const { data, error } = await enlaceDelCalendario(crearClienteNavegador(), hogar.id, renovar);
      if (error || !data) throw new Error("sin-enlace");
      setToken(data);
      setConfirmando(false);
      if (renovar)
        setMensaje("Enlace nuevo. Los móviles ya suscritos tienen que volver a suscribirse.");
    } catch {
      setMensaje("No se ha podido obtener el enlace. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  async function copiar(cual: string | null = enlace) {
    if (!cual) return;
    try {
      await navigator.clipboard.writeText(cual);
      setMensaje("Enlace copiado. En Google Calendar: «Otros calendarios» → «Desde URL».");
    } catch {
      setMensaje("No se ha podido copiar. Mantén pulsado el enlace de abajo y cópialo a mano.");
    }
  }

  return (
    <section className="tarjeta flex flex-col gap-3" aria-label="Avisos en el calendario del móvil">
      <h2 className="text-xl font-extrabold">
        <span aria-hidden="true">🔔 </span>Avisos en el calendario del móvil
      </h2>
      <p className="text-base">
        El móvil avisa solo, <strong>con la app cerrada</strong>: lo que toca en casa, las citas
        apuntadas, los cumpleaños y los avisos para pensar y comprar los regalos (menos el tuyo). Se
        actualiza solo en unas horas.
      </p>

      {fase !== "conectado" || !hogar ? (
        <p className="bg-suave-1 rounded-2xl p-3 text-base font-semibold">
          Primero entra con tu cuenta y únete a un hogar (en «Cuenta»): el enlace es del hogar.
        </p>
      ) : !persona ? (
        <p className="bg-suave-1 rounded-2xl p-3 text-base font-semibold">
          Elige tu perfil arriba (el botón con tu inicial) para que los avisos sean los tuyos.
        </p>
      ) : !enlace ? (
        <button
          type="button"
          className="boton w-fit"
          disabled={ocupado}
          onClick={() => void pedir(false)}
        >
          Activar los avisos de {persona.nombre}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <a className="boton" href={webcal ?? undefined}>
              Suscribirme en el iPhone
            </a>
            <button type="button" className="boton-suave" onClick={() => void copiar()}>
              Copiar el enlace
            </button>
          </div>
          <div className="border-borde flex flex-col gap-2 rounded-2xl border p-3">
            <p className="text-base">
              <span aria-hidden="true">🍽️ </span>
              <strong>Comidas y cenas, en un calendario aparte</strong> (comida a las 14:00, cena a
              las 20:00 entre semana y a las 21:00 el fin de semana). Así en Google tienen su color
              y las puedes ocultar.
            </p>
            <div className="flex flex-wrap gap-2">
              <a className="boton-suave" href={webcalComidas ?? undefined}>
                Suscribir las comidas en el iPhone
              </a>
              <button
                type="button"
                className="boton-suave"
                onClick={() => void copiar(enlaceComidas)}
              >
                Copiar el enlace de comidas y cenas
              </button>
            </div>
          </div>
          <ol className="text-tinta-suave list-decimal space-y-1 pl-5 text-base">
            <li>
              <strong>iPhone:</strong> pulsa «Suscribirme» y confirma «Suscribir». Para que avise,
              en Ajustes → Calendario → Cuentas → Calendarios suscritos comprueba que no esté
              marcado «Eliminar alertas».
            </li>
            <li>
              <strong>Google Calendar (Android o iPhone):</strong> copia el enlace. La app de Google
              Calendar no deja añadirlo: abre calendar.google.com en el navegador del móvil con
              «Versión para ordenador», y en «Otros calendarios» → «Desde URL» pégalo. Después sale
              también en la app. Google lo refresca solo, pero tarda entre medio día y un día en
              enseñar los cambios, y usa sus propios avisos: ajústalos en ese calendario.
            </li>
          </ol>
          <p className="bg-ok-fondo text-ok-texto rounded-2xl p-3 text-base">
            🔒 <strong>Este enlace es secreto.</strong> Quien lo tenga ve el plan de la casa. No lo
            pegues fuera de la familia.
          </p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Tu enlace
            <input
              className="campo"
              readOnly
              value={enlace}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          {confirmando ? (
            <div className="bg-suave-1 flex flex-col gap-2 rounded-2xl p-3" role="alert">
              <p className="text-base font-bold">
                Los enlaces actuales dejarán de funcionar y habrá que volver a suscribir cada móvil.
                ¿Seguro?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="boton"
                  disabled={ocupado}
                  onClick={() => void pedir(true)}
                >
                  Sí, renovar
                </button>
                <button type="button" className="boton-suave" onClick={() => setConfirmando(false)}>
                  No
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="boton-suave w-fit"
              onClick={() => setConfirmando(true)}
            >
              Renovar el enlace (si se ha compartido por error)
            </button>
          )}
        </div>
      )}
      {mensaje && (
        <p role="status" className="bg-ok-fondo text-ok-texto rounded-2xl p-3 text-base">
          {mensaje}
        </p>
      )}
    </section>
  );
}
