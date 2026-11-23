"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { planDeSincronizacion, type ResultadoDeSincronizacion } from "@/dominio/todoist";
import { useHogar } from "./proveedor-hogar";
import { useYo } from "./yo";

/**
 * Pendientes ↔ Todoist (D-205). El servidor tiene el token; aquí solo se pregunta si está
 * configurado y se manda lo que hay que crear y cerrar. Solo quien es la dueña de la cuenta de Todoist
 * (`TODOIST_PERSONA_ID`, por defecto Diego) lo ve. Una sola sincronización a la vez, y la automática
 * como mucho cada 5 minutos.
 */

interface Configuracion {
  configurado: boolean;
  persona: string;
}

const CADA_MS = 5 * 60_000;
let configuracion: Promise<Configuracion | null> | null = null;
let enCurso: Promise<void> | null = null;
let ultimaVez = 0;

function leerConfiguracion(): Promise<Configuracion | null> {
  // Los datos de ejemplo (las pruebas) no hablan con nadie.
  if (process.env.NEXT_PUBLIC_DATOS === "ejemplo") return Promise.resolve(null);
  configuracion ??= fetch("/api/todoist", { cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) return null;
      const v = (await r.json()) as Partial<Configuracion>;
      return typeof v.configurado === "boolean" && typeof v.persona === "string"
        ? { configurado: v.configurado, persona: v.persona }
        : null;
    })
    .catch(() => null);
  return configuracion;
}

export type SituacionTodoist = "listo" | "sincronizando" | "ok" | "error";

export function useTodoist(auto: boolean) {
  const { estado, despachar, cargado } = useHogar();
  const [yoId] = useYo();
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [situacion, setSituacion] = useState<SituacionTodoist>("listo");
  const [mensaje, setMensaje] = useState("");
  const [ultima, setUltima] = useState<number | null>(ultimaVez || null);
  const ultimo = useRef(estado);
  useEffect(() => {
    ultimo.current = estado;
  });

  useEffect(() => {
    let vivo = true;
    void leerConfiguracion().then((c) => vivo && setConfig(c));
    return () => {
      vivo = false;
    };
  }, []);

  const visible = Boolean(config?.configurado && yoId && yoId === config.persona);

  const sincronizar = useCallback(async () => {
    if (!config?.configurado || !yoId || yoId !== config.persona) return;
    if (enCurso) {
      await enCurso;
      return;
    }
    const e = ultimo.current;
    const plan = planDeSincronizacion(e.pendientes, e.todoistPorCerrar, config.persona);
    setSituacion("sincronizando");
    setMensaje("");
    enCurso = (async () => {
      try {
        const r = await fetch("/api/todoist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plan),
        });
        if (!r.ok) {
          const v = (await r.json().catch(() => ({}))) as { motivo?: string };
          throw new Error(v.motivo ?? "red");
        }
        const res = (await r.json()) as ResultadoDeSincronizacion;
        despachar({ tipo: "todoist/aplicar", personaId: config.persona, ...res });
        ultimaVez = Date.now();
        setUltima(ultimaVez);
        setSituacion("ok");
      } catch (err) {
        const motivo = err instanceof Error ? err.message : "red";
        setSituacion("error");
        setMensaje(
          motivo === "token"
            ? "Todoist no acepta el token: revisa TODOIST_TOKEN en Railway."
            : motivo === "demasiadas"
              ? "Hay demasiadas tareas en el proyecto «¡Hecho!» de Todoist."
              : "No se ha podido hablar con Todoist. Se reintenta luego.",
        );
      } finally {
        enCurso = null;
      }
    })();
    await enCurso;
  }, [config, yoId, despachar]);

  // La automática: al abrir y al volver a la app, si hace más de 5 minutos.
  useEffect(() => {
    if (!auto || !visible || !cargado) return;
    const tocar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimaVez > CADA_MS) {
        void sincronizar();
      }
    };
    tocar();
    document.addEventListener("visibilitychange", tocar);
    return () => document.removeEventListener("visibilitychange", tocar);
  }, [auto, visible, cargado, sincronizar]);

  return { visible, situacion, mensaje, ultima, sincronizar };
}
