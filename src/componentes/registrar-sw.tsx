"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (D-129): guarda la app en el móvil para que abra sin conexión. Solo
 * en producción (en desarrollo estorba al recargar). Sin pintar nada; si el navegador no lo admite
 * o falla, la app funciona igual, solo que necesita internet para abrirse.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const registrar = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };
    // Tras cargar la página: guardar la app no debe competir con lo que se está abriendo.
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
    return () => window.removeEventListener("load", registrar);
  }, []);
  return null;
}
