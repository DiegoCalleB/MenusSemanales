"use client";

import { useTodoist } from "./usar-todoist";

const hace = (ms: number) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  return m < 1 ? "ahora mismo" : m === 1 ? "hace 1 min" : `hace ${m} min`;
};

/**
 * La línea de Todoist en los pendientes (D-205): cuándo se sincronizó y un botón para hacerlo ya. Solo
 * se ve si Todoist está configurado y eres la dueña de la cuenta.
 */
export function TodoistSincronizar() {
  const t = useTodoist(false);
  if (!t.visible) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="boton-suave"
        disabled={t.situacion === "sincronizando"}
        onClick={() => void t.sincronizar()}
      >
        <span aria-hidden="true">🔄 </span>
        {t.situacion === "sincronizando" ? "Sincronizando…" : "Sincronizar con Todoist"}
      </button>
      <p role="status" className="text-tinta-suave text-sm">
        {t.situacion === "error"
          ? t.mensaje
          : t.ultima
            ? `Todoist: sincronizado ${hace(t.ultima)}`
            : "Todoist conectado"}
      </p>
    </div>
  );
}

/** La sincronización automática de Todoist (D-205): al abrir Hoy y al volver a la app. No pinta nada. */
export function TodoistAutomatico() {
  useTodoist(true);
  return null;
}
