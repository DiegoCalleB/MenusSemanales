import { AVISOS_POR_DEFECTO, type ItemCaptura } from "@/dominio/ia-captura";
import { normalizar } from "@/dominio/busqueda";
import type { Accion } from "./estado";

/** La persona de la familia que corresponde al nombre que se dijo (sin tildes ni mayúsculas). */
export function personaDe(
  nombre: string | null,
  personas: ReadonlyArray<{ id: string; nombre: string; activa: boolean }>,
): string | null {
  if (!nombre) return null;
  const n = normalizar(nombre);
  const activas = personas.filter((p) => p.activa);
  return (
    activas.find((p) => normalizar(p.nombre) === n)?.id ??
    activas.find((p) => normalizar(p.nombre).startsWith(n) || n.startsWith(normalizar(p.nombre)))
      ?.id ??
    null
  );
}

/**
 * Lo que apunta la app por cada cosa que propuso la IA (D-178): usa las mismas acciones que las
 * pantallas de siempre, así que valen las mismas reglas (y el mismo «ya estaba apuntado»).
 */
export function accionesDeCaptura(
  items: readonly ItemCaptura[],
  personas: ReadonlyArray<{ id: string; nombre: string; activa: boolean }>,
  nuevoId: () => string,
): Accion[] {
  return items.map((i): Accion => {
    const personaId = personaDe(i.persona, personas);
    switch (i.tipo) {
      case "compra":
        return { tipo: "manual/anadir", nombre: i.titulo };
      case "evento":
        return {
          tipo: "agenda/cita",
          fecha: i.fecha ?? "",
          hasta: i.hasta,
          hora: i.hora,
          titulo: i.titulo,
          idBase: nuevoId(),
        };
      case "papel":
        return {
          tipo: "vencimiento/guardar",
          titulo: i.titulo,
          categoria: i.categoria,
          personaId,
          fecha: i.fecha ?? "",
          repiteMeses: i.repiteMeses,
          avisos: AVISOS_POR_DEFECTO,
          notas: "",
          idBase: nuevoId(),
        };
      case "pendiente":
        return {
          tipo: "pendiente/anadir",
          texto: i.titulo,
          personaId,
          importante: i.importante,
          idBase: nuevoId(),
        };
    }
  });
}
