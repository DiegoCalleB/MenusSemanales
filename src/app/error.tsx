"use client";

import { useEffect, useState } from "react";

/**
 * Si algo falla al dibujar la app, en vez del aviso genérico se enseña qué ha pasado (para poder
 * arreglarlo) y se ofrece volver a intentarlo. Los datos del hogar en la nube no se tocan.
 */
export default function ErrorApp({ error, retry }: { error: unknown; retry: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  useEffect(() => {
    console.error(error);
  }, [error]);
  const mensaje = error instanceof Error ? error.message : String(error);
  const digest = (error as { digest?: string } | null)?.digest;

  function borrarLocal() {
    try {
      // Solo lo guardado en este móvil. El perfil y el tema se conservan.
      window.localStorage.removeItem("menus-semanales:prueba");
    } catch {
      // sin almacenamiento: nada que borrar
    }
    window.location.reload();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Algo ha fallado 😕</h1>
      <p className="text-base">
        La app no ha podido abrirse. Prueba a volver a intentarlo; si sigue igual, dime qué pone
        aquí abajo.
      </p>
      <pre className="bg-fondo border-borde overflow-auto rounded-2xl border p-3 text-sm whitespace-pre-wrap">
        {mensaje.slice(0, 400)}
        {digest ? `\n(${digest})` : ""}
      </pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton" onClick={() => retry()}>
          Volver a intentarlo
        </button>
        <button type="button" className="boton-suave" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
      {confirmando ? (
        <div className="bg-suave-1 flex flex-col gap-2 rounded-2xl p-3" role="alert">
          <p className="text-base font-bold">
            Se borra lo guardado solo en este móvil. Lo que esté en la nube (si has entrado con tu
            cuenta) se vuelve a descargar. ¿Seguro?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton" onClick={borrarLocal}>
              Sí, borrar y recargar
            </button>
            <button type="button" className="boton-suave" onClick={() => setConfirmando(false)}>
              No
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="boton-suave w-fit" onClick={() => setConfirmando(true)}>
          Borrar lo guardado en este móvil
        </button>
      )}
    </main>
  );
}
