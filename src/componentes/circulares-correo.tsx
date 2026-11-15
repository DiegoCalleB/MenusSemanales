"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { direccionDeCirculares } from "@/dominio/correo-circular";
import { crearClienteNavegador } from "@/infraestructura/supabase/cliente-navegador";
import {
  circularesPendientes,
  codigoCirculares,
  revisarCircular,
} from "@/infraestructura/supabase/cuenta";
import { LeerCircular } from "./leer-circular";
import { useCuenta } from "./proveedor-hogar";

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .catch(null);
const pendientesSchema = z.array(
  z.object({
    id: z.string(),
    asunto: z.string().catch(""),
    recibidaEn: z.string(),
    items: z
      .array(
        z.object({
          tipo: z.enum(["cita", "tarea"]),
          titulo: z.string().min(1).max(200),
          fecha,
          hasta: fecha,
          hora: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .nullable()
            .catch(null),
        }),
      )
      .catch([]),
  }),
);
type Pendiente = z.infer<typeof pendientesSchema>[number];

const cuando = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));

/**
 * Circulares del cole por correo (D-147): la dirección del hogar para reenviarlas y las que han
 * llegado, ya leídas con IA, para elegir qué apuntar. Nada se apunta solo. Solo con cuenta.
 */
export function CircularesCorreo() {
  const { fase, hogar } = useCuenta();
  const [dominio, setDominio] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    if (!hogar) return;
    const cliente = crearClienteNavegador();
    const [d, c, p] = await Promise.all([
      fetch("/api/circulares/dominio")
        .then((r) => (r.ok ? (r.json() as Promise<{ dominio?: string }>) : { dominio: "" }))
        .catch(() => ({ dominio: "" })),
      codigoCirculares(cliente, hogar.id),
      circularesPendientes(cliente, hogar.id),
    ]);
    setDominio(d.dominio ?? "");
    if (!c.error && typeof c.data === "string") setCodigo(c.data);
    const lista = pendientesSchema.safeParse(p.data);
    setPendientes(!p.error && lista.success ? lista.data : []);
  }, [hogar]);

  useEffect(() => {
    if (fase !== "conectado") return;
    void Promise.resolve().then(cargar);
  }, [fase, cargar]);

  if (fase !== "conectado" || !hogar) return null;
  const direccion = dominio && codigo ? direccionDeCirculares(codigo, dominio) : "";

  async function terminar(id: string) {
    await revisarCircular(crearClienteNavegador(), id);
    setPendientes((l) => l.filter((x) => x.id !== id));
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(direccion);
      setMensaje("Dirección copiada.");
    } catch {
      setMensaje("No he podido copiarla: mantén pulsada la dirección y cópiala a mano.");
    }
  }

  async function cambiar() {
    if (!hogar || !window.confirm("¿Cambiar la dirección? La de ahora dejará de funcionar."))
      return;
    const { data, error } = await codigoCirculares(crearClienteNavegador(), hogar.id, true);
    if (!error && typeof data === "string") {
      setCodigo(data);
      setMensaje("Dirección nueva. Si la tenías en un filtro del correo, cámbiala allí también.");
    }
  }

  if (!direccion && pendientes.length === 0) return null;

  return (
    <section aria-labelledby="circulares-correo" className="tarjeta flex flex-col gap-3">
      <h2 id="circulares-correo" className="text-xl font-extrabold">
        <span aria-hidden="true">📬 </span>Circulares por correo
      </h2>
      {direccion && (
        <div className="flex flex-col gap-2">
          <p className="text-base">
            Reenvía aquí los correos del cole. Leo el PDF o el texto y te aviso para que elijas qué
            apuntar:
          </p>
          <p className="bg-suave-1 rounded-2xl p-3 font-mono text-sm break-all select-all">
            {direccion}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton-suave" onClick={() => void copiar()}>
              Copiar la dirección
            </button>
            <button type="button" className="boton-suave" onClick={() => void cambiar()}>
              Cambiarla
            </button>
          </div>
          {mensaje && (
            <p role="status" className="text-base">
              {mensaje}
            </p>
          )}
        </div>
      )}
      {pendientes.map((p) => (
        <div key={p.id} className="border-borde flex flex-col gap-2 rounded-2xl border p-3">
          <p className="text-base font-semibold">
            {p.asunto || "Correo reenviado"}
            <span className="text-tinta-suave block text-sm font-normal">
              Llegó el {cuando(p.recibidaEn)}
            </span>
          </p>
          {p.items.length > 0 ? (
            <LeerCircular leidos={p.items} alTerminar={() => void terminar(p.id)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-tinta-suave text-base">No he encontrado fechas ni tareas.</p>
              <button type="button" className="boton-suave" onClick={() => void terminar(p.id)}>
                Quitar
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
