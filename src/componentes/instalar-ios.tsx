"use client";

import { useState, useSyncExternalStore } from "react";

const CLAVE = "menus-semanales:instalar-ios-oculto";
const nadie = () => () => {};

function esIphoneEnSafari(): boolean {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalada =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return ios && !instalada;
}

function oculto(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

/**
 * En iPhone la app funciona mejor instalada en la pantalla de inicio: se abre como una app, sin
 * barras del navegador, y Safari no borra sus datos a los 7 días sin uso (como sí hace con las
 * páginas web normales). Solo se enseña en iPhone o iPad y mientras no esté instalada.
 */
export function AyudaInstalarIos() {
  const [cerrado, setCerrado] = useState(false);
  const mostrar = useSyncExternalStore(
    nadie,
    () => esIphoneEnSafari() && !oculto(),
    () => false,
  );
  if (!mostrar || cerrado) return null;
  return (
    <section aria-labelledby="instalar" className="tarjeta bg-suave-1 flex flex-col gap-2">
      <h2 id="instalar" className="text-lg font-extrabold">
        📲 Ponla como app en tu iPhone
      </h2>
      <ol className="list-decimal space-y-1 pl-5 text-base">
        <li>
          Toca el botón <strong>Compartir</strong> de Safari (el cuadrado con la flecha hacia
          arriba).
        </li>
        <li>
          Elige <strong>«Añadir a pantalla de inicio»</strong>.
        </li>
        <li>Ábrela desde el icono 🍽️: se ve a pantalla completa y no pierde tus datos.</li>
      </ol>
      <button
        type="button"
        className="boton-suave w-fit"
        onClick={() => {
          try {
            window.localStorage.setItem(CLAVE, "1");
          } catch {
            // sin almacenamiento: se cierra solo hasta recargar
          }
          setCerrado(true);
        }}
      >
        Entendido
      </button>
    </section>
  );
}
