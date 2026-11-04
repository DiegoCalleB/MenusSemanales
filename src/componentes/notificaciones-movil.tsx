"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import { guardarSuscripcionPush, quitarSuscripcionPush } from "@/infraestructura/supabase/cuenta";
import { useCuenta } from "./proveedor-hogar";

type Estado =
  | "comprobando"
  | "no-soportado"
  | "ios-sin-instalar"
  | "sin-configurar"
  | "denegado"
  | "inactivas"
  | "activas";

const aBytes = (base64: string): Uint8Array<ArrayBuffer> => {
  const limpio = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bin = atob(limpio);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const esIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const estaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/**
 * Notificaciones en el móvil (D-115): cada mañana a las 10 llega el aviso de hoy aunque la app
 * esté cerrada. Cada móvil las activa por su cuenta. Necesita que el servidor tenga sus claves
 * (se generan desde aquí una vez y se ponen en Railway) y, en iPhone, la app instalada.
 */
export function NotificacionesMovil() {
  const { fase, hogar } = useCuenta();
  const [estado, setEstado] = useState<Estado>("comprobando");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [claves, setClaves] = useState<{ publica: string; privada: string } | null>(null);

  const comprobar = useCallback(async () => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setEstado(esIos() && !estaInstalada() ? "ios-sin-instalar" : "no-soportado");
      return;
    }
    if (esIos() && !estaInstalada()) return setEstado("ios-sin-instalar");
    try {
      const r = await fetch("/api/push/clave", { cache: "no-store" });
      if (!r.ok) return setEstado("sin-configurar");
    } catch {
      return setEstado("sin-configurar");
    }
    if (Notification.permission === "denied") return setEstado("denegado");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setEstado(sub ? "activas" : "inactivas");
  }, []);

  useEffect(() => {
    void Promise.resolve().then(comprobar);
  }, [comprobar]);

  const token = async () =>
    (await crearClienteNavegador().auth.getSession()).data.session?.access_token ?? "";

  async function activar() {
    if (!hogar) return;
    setOcupado(true);
    setMensaje("");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "denegado" : "inactivas");
        return;
      }
      const { clave } = (await (await fetch("/api/push/clave", { cache: "no-store" })).json()) as {
        clave: string;
      };
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: aBytes(clave),
        }));
      const j = sub.toJSON();
      if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) throw new Error("suscripcion-incompleta");
      const { error } = await guardarSuscripcionPush(crearClienteNavegador(), hogar.id, {
        endpoint: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
      });
      if (error) {
        await sub.unsubscribe();
        throw new Error("no-guardada");
      }
      setEstado("activas");
      setMensaje("Notificaciones activadas en este móvil.");
    } catch {
      setMensaje(
        "No se han podido activar. Si acabas de poner las claves en Railway, espera a que termine de desplegar y vuelve a intentarlo.",
      );
    } finally {
      setOcupado(false);
    }
  }

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
        Cada mañana a las 10 te llega el aviso de hoy: la cena, las citas, lo que toca en casa y los
        cumpleaños que se acercan. Aunque la app esté cerrada.
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
            <strong>Falta un paso, una sola vez.</strong> El servidor necesita unas claves para
            poder enviar notificaciones. Genéralas aquí y ponlas en Railway → tu servicio →
            Variables: <code>VAPID_PUBLIC_KEY</code> (la pública) y <code>VAPID_PRIVATE_KEY</code>{" "}
            (la privada). Cuando Railway termine de desplegar, vuelve aquí.
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
          <button type="button" className="boton-suave w-fit" onClick={() => void comprobar()}>
            Ya las he puesto: comprobar
          </button>
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
