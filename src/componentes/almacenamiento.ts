"use client";

import { useEffect, useState } from "react";

/**
 * Almacenamiento protegido (D-208): le pide al navegador que NO borre los datos de este móvil si le
 * falta espacio o pasa mucho tiempo sin abrir la app. Es lo que hace que «guardar en el móvil» sea de
 * fiar sin cobertura. Devuelve true si está protegido, false si el navegador no lo concede y null si
 * no se puede saber.
 */
export async function protegerAlmacenamiento(
  almacen: Pick<StorageManager, "persist" | "persisted"> | undefined = typeof navigator ===
  "undefined"
    ? undefined
    : navigator.storage,
): Promise<boolean | null> {
  try {
    if (!almacen?.persist || !almacen.persisted) return null;
    if (await almacen.persisted()) return true;
    return await almacen.persist();
  } catch {
    return null;
  }
}

/** Si el almacenamiento de este móvil está protegido (se pide una vez al abrir la app). */
export function useAlmacenamientoProtegido(): boolean | null {
  const [protegido, setProtegido] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void protegerAlmacenamiento().then((v) => vivo && setProtegido(v));
    return () => {
      vivo = false;
    };
  }, []);
  return protegido;
}
