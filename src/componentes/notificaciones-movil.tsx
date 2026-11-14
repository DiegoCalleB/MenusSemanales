"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import { pedirPruebaPush, quitarSuscripcionPush } from "@/infraestructura/supabase/cuenta";
import { useCuenta } from "./proveedor-hogar";
import { useNotificaciones } from "./usar-notificaciones";

/**
 * Notificaciones en el móvil (D-115, D-139): cada mañana a las 9 llega el aviso de hoy y a las 20
 * el recordatorio de lo que hay que dejar preparado, aunque la app esté cerrada. Cada móvil las
 * activa por su cuenta. Las claves del servidor las crea y guarda la base de datos sola (antes había
 * que ponerlas en Railway; sigue pudiéndose) y, en iPhone, hace falta la app instalada.
 */
export function NotificacionesMovil() {
  const { fase, hogar } = useCuenta();
  const { estado, setEstado, mensaje, setMensaje, ocupado, setOcupado, activar } =
    useNotificaciones();
  const [claves, setClaves] = useState<{ publica: string; privada: string } | null>(null);

  const token = async () =>
    (await crearClienteNavegador().auth.getSession()).data.session?.access_token ?? "";

  async function desactivar() {
    setOcupado(true);
    setMensaje("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const { error } = await quitarSuscripcionPush(crearClienteNavegador(), sub.endpoint);
        if (error) throw new Error("no-quitada");
        await sub.unsubscribe();
      }
      setEstado("inactivas");
      setMensaje("Notificaciones desactivadas en este móvil.");
    } catch {
      setMensaje("No se han podido desactivar. Comprueba la conexión.");
    } finally {
      setOcupado(false);
    }
  }

  async function probar() {
    setOcupado(true);
    setMensaje("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) throw new Error("sin-suscripcion");
      const r = await fetch("/api/push/prueba", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      // Sin claves en Railway, las tiene la base de datos: ella pide a la app que mande la prueba (D-139).
      if (r.status === 503 && hogar) {
        const { data, error } = await pedirPruebaPush(
          crearClienteNavegador(),
          hogar.id,
          sub.endpoint,
        );
        setMensaje(
          !error && data
            ? "Prueba pedida: te llegará en unos segundos."
            : "No se ha podido enviar la prueba. Desactívalas y vuelve a activarlas.",
        );
        return;
      }
      setMensaje(
        r.ok
          ? "Prueba enviada: debería llegarte ahora mismo."
          : r.status === 410
            ? "Este móvil ya no está registrado. Desactívalas y vuelve a activarlas."
            : "No se ha podido enviar la prueba.",
      );
    } catch {
      setMensaje("No se ha podido enviar la prueba.");
    } finally {
      setOcupado(false);
    }
  }

  async function generarClaves() {
    setOcupado(true);
    setMensaje("");
    try {
      const r = await fetch("/api/push/claves", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}` },
      });
      if (!r.ok) throw new Error("no-claves");
      setClaves((await r.json()) as { publica: string; privada: string });
    } catch {
      setMensaje("No se han podido generar las claves. Comprueba que has entrado en tu cuenta.");
    } finally {
      setOcupado(false);
    }
  }

  const copiar = async (texto: string, que: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setMensaje(`${que} copiada.`);
    } catch {
      setMensaje("No se ha podido copiar: mantén pulsado el texto y cópialo a mano.");
    }
  };

  return (
    <section className="tarjeta flex flex-col gap-3" aria-label="Notificaciones en el móvil">
      <h2 className="text-xl font-extrabold">
        <span aria-hidden="true">📲 </span>Notificaciones en el móvil
      </h2>
      <p className="text-base">
        Cada mañana a las 9 te llega el aviso de hoy: la cena, las citas, lo que toca en casa y los
        cumpleaños que se acercan. A las 7, si va a llover a la hora del cole, el del paraguas. Y a
        las 20, si hay que dejar algo preparado (la mochila) o hay una cita mañana, un recordatorio.
        Aunque la app esté cerrada.
      </p>

      {fase !== "conectado" || !hogar ? (
        <p className="bg-suave-1 rounded-2xl p-3 text-base font-semibold">
          Primero entra con tu cuenta y únete a un hogar (en «Cuenta»).
        </p>
      ) : estado === "comprobando" ? (
        <p className="text-tinta-suave text-base">Comprobando…</p>
      ) : estado === "no-soportado" ? (
        <p className="bg-suave-1 rounded-2xl p-3 text-base font-semibold">
          Este navegador no admite notificaciones. Prueba con Chrome o Brave en Android.
        </p>
      ) : estado === "ios-sin-instalar" ? (
        <p className="bg-suave-1 rounded-2xl p-3 text-base font-semibold">
          En el iPhone las notificaciones solo funcionan con la app instalada: en Safari pulsa
          Compartir → «Añadir a pantalla de inicio», abre la app desde el icono y vuelve aquí.
        </p>
      ) : estado === "sin-configurar" ? (
        <div className="flex flex-col gap-3">
          <p className="bg-suave-1 rounded-2xl p-3 text-base">
            <strong>El servidor aún está preparando las notificaciones.</strong> Lo hace solo la
            primera vez y tarda como mucho una hora. Vuelve a intentarlo en un rato.
          </p>
          <button
            type="button"
            className="boton w-fit"
            disabled={ocupado}
            onClick={() => void activar()}
          >
            Volver a intentarlo
          </button>
          <details>
            <summary className="text-tinta-suave cursor-pointer text-sm">
              Hacerlo a mano (claves en Railway)
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              <p className="text-base">
                Genera aquí las claves y ponlas en Railway → tu servicio → Variables:{" "}
                <code>VAPID_PUBLIC_KEY</code> (la pública) y <code>VAPID_PRIVATE_KEY</code> (la
                privada). Cuando Railway termine de desplegar, vuelve aquí.
              </p>
              {!claves ? (
                <button
                  type="button"
                  className="boton w-fit"
                  disabled={ocupado}
                  onClick={() => void generarClaves()}
                >
                  Generar las claves
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-aviso-texto text-base font-semibold">
                    🔒 La privada es secreta: pégala solo en Railway, no la mandes por ningún chat.
                    Estas claves no se guardan en ningún sitio: si cierras esto, genera otras.
                  </p>
                  {(
                    [
                      ["VAPID_PUBLIC_KEY", claves.publica, "Clave pública"],
                      ["VAPID_PRIVATE_KEY", claves.privada, "Clave privada"],
                    ] as const
                  ).map(([nombre, valor, etiqueta]) => (
                    <div key={nombre} className="flex flex-col gap-1">
                      <label className="text-sm font-semibold" htmlFor={nombre}>
                        {nombre}
                      </label>
                      <input
                        id={nombre}
                        className="campo font-mono text-sm"
                        readOnly
                        value={valor}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <button
                        type="button"
                        className="boton-suave w-fit"
                        onClick={() => void copiar(valor, etiqueta)}
                      >
                        Copiar {etiqueta.toLowerCase()}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="boton-suave w-fit"
                disabled={ocupado}
                onClick={() => void activar()}
              >
                Ya las he puesto: activar ahora
              </button>
            </div>
          </details>
        </div>
      ) : estado === "denegado" ? (
        <p className="bg-suave-1 rounded-2xl p-3 text-base font-semibold">
          Has bloqueado las notificaciones de esta web. Para activarlas, en el navegador: icono del
          candado junto a la dirección → Permisos → Notificaciones → Permitir.
        </p>
      ) : estado === "inactivas" ? (
        <button
          type="button"
          className="boton w-fit"
          disabled={ocupado}
          onClick={() => void activar()}
        >
          Activar en este móvil
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton" disabled={ocupado} onClick={() => void probar()}>
            Enviarme una prueba
          </button>
          <button
            type="button"
            className="boton-suave"
            disabled={ocupado}
            onClick={() => void desactivar()}
          >
            Desactivar en este móvil
          </button>
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
