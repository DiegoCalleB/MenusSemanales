"use client";

import { useCallback, useEffect, useState } from "react";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import { guardarSuscripcionPush } from "@/infraestructura/supabase/cuenta";
import { useCuenta } from "./proveedor-hogar";

export type EstadoNotificaciones =
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
 * Las notificaciones de este móvil (D-115, D-139): si se pueden usar, si están activas y cómo
 * activarlas. Lo usan la tarjeta de «Compartir» y el recordatorio de «Hoy» (D-150).
 */
export function useNotificaciones() {
  const { hogar } = useCuenta();
  const [estado, setEstado] = useState<EstadoNotificaciones>("comprobando");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

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
    if (Notification.permission === "denied") return setEstado("denegado");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setEstado(sub ? "activas" : "inactivas");
  }, []);

  useEffect(() => {
    void Promise.resolve().then(comprobar);
  }, [comprobar]);

  async function activar(): Promise<boolean> {
    if (!hogar) return false;
    setOcupado(true);
    setMensaje("");
    try {
      // Primero se pregunta al servidor si ya tiene sus claves: si no, no tiene sentido pedir permiso.
      const r = await fetch("/api/push/clave", { cache: "no-store" });
      if (!r.ok) {
        await r.text().catch(() => "");
        setEstado("sin-configurar");
        return false;
      }
      const { clave } = (await r.json()) as { clave: string };
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "denegado" : "inactivas");
        return false;
      }
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
      return true;
    } catch {
      setMensaje(
        "No se han podido activar. Si acabas de poner las claves en Railway, espera a que termine de desplegar y vuelve a intentarlo.",
      );
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return { estado, setEstado, mensaje, setMensaje, ocupado, setOcupado, activar };
}
