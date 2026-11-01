"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Tema = "claro" | "oscuro";
const CLAVE = "menus-semanales:tema";

const Contexto = createContext<{ tema: Tema; alternar: () => void } | null>(null);

/**
 * El tema es claro por defecto, también si el móvil está en modo oscuro: la app es alegre y
 * luminosa (D-045, D-049). Quien prefiera el oscuro lo elige y se recuerda en este dispositivo.
 */
export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("claro");

  useEffect(() => {
    try {
      // Se lee una vez al montar; el valor guardado es solo una preferencia del propio usuario.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(CLAVE) === "oscuro") setTema("oscuro");
    } catch {
      // sin almacenamiento: se queda en claro
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tema === "oscuro" ? "dark" : "light";
  }, [tema]);

  function alternar() {
    const siguiente: Tema = tema === "claro" ? "oscuro" : "claro";
    setTema(siguiente);
    try {
      window.localStorage.setItem(CLAVE, siguiente);
    } catch {
      // nada que hacer
    }
  }

  return <Contexto.Provider value={{ tema, alternar }}>{children}</Contexto.Provider>;
}

export function BotonTema() {
  const c = useContext(Contexto);
  if (!c) throw new Error("BotonTema debe usarse dentro de <ProveedorTema>");
  const oscuro = c.tema === "oscuro";
  return (
    <button type="button" className="boton-suave" onClick={c.alternar} aria-pressed={oscuro}>
      <span aria-hidden="true">{oscuro ? "☀️" : "🌙"}</span>
      <span className="sr-only min-[420px]:not-sr-only">
        {oscuro ? "Tema claro" : "Tema oscuro"}
      </span>
    </button>
  );
}
