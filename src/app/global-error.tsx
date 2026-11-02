"use client";

import { useEffect } from "react";

/**
 * Último recurso: si falla incluso la estructura de la app, en vez del aviso genérico en inglés se
 * enseña qué ha pasado. Sin estilos propios (sustituye a toda la página y la CSP no admite inline).
 */
export default function ErrorGlobal({ error }: { error: unknown }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const mensaje = error instanceof Error ? error.message : String(error);
  const digest = (error as { digest?: string } | null)?.digest;
  return (
    <html lang="es">
      <body>
        <main>
          <h1>Algo ha fallado 😕</h1>
          <p>La app no ha podido abrirse. Dime qué pone aquí abajo:</p>
          <pre>
            {mensaje.slice(0, 400)}
            {digest ? `\n(${digest})` : ""}
          </pre>
          <button type="button" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </main>
      </body>
    </html>
  );
}
