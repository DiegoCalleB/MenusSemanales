"use client";

import { useEffect, useState } from "react";
import { type AjustesAuth, leerAjustesAuth } from "@/infraestructura/diagnostico-auth";

const marca = (v: boolean | null) => (v === null ? "❔" : v ? "✅" : "⚠️");

/**
 * Antes de intentar entrar, mira qué permite Supabase y lo cuenta en cristiano: si «Entrar sin
 * correo» está apagado, no hace falta probar para descubrirlo (fase 0, D-086). Si Supabase no lo
 * dice o no responde, no enseña nada.
 */
export function DiagnosticoAcceso() {
  const [ajustes, setAjustes] = useState<AjustesAuth | null>(null);
  useEffect(() => {
    let vigente = true;
    void leerAjustesAuth().then((a) => vigente && setAjustes(a));
    return () => {
      vigente = false;
    };
  }, []);
  if (!ajustes) return null;
  const hayProblema =
    ajustes.anonimos === false || ajustes.correo === false || ajustes.registroAbierto === false;
  return (
    <section aria-label="Estado del acceso" className="tarjeta flex flex-col gap-2">
      <h2 className="text-lg font-extrabold">
        {hayProblema ? "⚠️ Falta activar el acceso" : "Estado del acceso"}
      </h2>
      <ul className="flex flex-col gap-1 text-base">
        <li>
          {marca(ajustes.anonimos)} <strong>Entrar sin correo:</strong>{" "}
          {ajustes.anonimos === null ? "no se sabe" : ajustes.anonimos ? "activado" : "apagado"}
        </li>
        <li>
          {marca(ajustes.correo)} <strong>Entrar con correo:</strong>{" "}
          {ajustes.correo === null ? "no se sabe" : ajustes.correo ? "activado" : "apagado"}
        </li>
        <li>
          {marca(ajustes.registroAbierto)} <strong>Crear cuentas nuevas:</strong>{" "}
          {ajustes.registroAbierto === null
            ? "no se sabe"
            : ajustes.registroAbierto
              ? "permitido"
              : "bloqueado"}
        </li>
      </ul>
      {hayProblema && (
        <p className="text-tinta-suave text-base">
          Se cambia en Supabase → <strong>Authentication</strong> →{" "}
          <strong>Sign In / Providers</strong>: activa «Allow anonymous sign-ins» (entrar sin
          correo), «Email» y «Allow new users to sign up».
        </p>
      )}
    </section>
  );
}
