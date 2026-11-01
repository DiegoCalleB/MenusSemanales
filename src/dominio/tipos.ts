import { z } from "zod";
import type { FechaIso } from "./fechas";

/**
 * Tipos y esquemas del dominio. Reflejan las reglas de la base de datos (ver las migraciones) para
 * que un dato válido aquí también lo sea allí. Se validan con zod en los bordes de la aplicación.
 */

export const fechaIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha AAAA-MM-DD");

/** Orden de preferencia al cocinar: lo de la nevera se gasta antes que lo del congelador. */
export const UBICACIONES = ["nevera", "despensa", "congelador"] as const;
export const ubicacionSchema = z.enum(UBICACIONES);
export type Ubicacion = z.infer<typeof ubicacionSchema>;

/** Orden de las secciones en un supermercado: así la lista se recorre sin dar vueltas. */
export const SECCIONES = [
  "fruta_verdura",
  "panaderia",
  "carne",
  "pescado",
  "lacteos",
  "huevos",
  "conservas",
  "despensa",
  "congelados",
  "bebidas",
  "limpieza",
  "otros",
] as const;
export const seccionSchema = z.enum(SECCIONES);
export type Seccion = z.infer<typeof seccionSchema>;

export const unidadSchema = z.enum(["g", "ml", "ud"]);
export type Unidad = z.infer<typeof unidadSchema>;

export const ingredienteSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  unidad: unidadSchema,
  seccion: seccionSchema,
});
export type Ingrediente = z.infer<typeof ingredienteSchema>;

export const ingredienteDePlatoSchema = z.object({
  ingredienteId: z.string().min(1),
  cantidadPorRacion: z.number().positive(),
  opcional: z.boolean().default(false),
});
export type IngredienteDePlato = z.infer<typeof ingredienteDePlatoSchema>;

export const platoSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  ingredientes: z.array(ingredienteDePlatoSchema),
});
export type Plato = z.infer<typeof platoSchema>;

export const itemDespensaSchema = z.object({
  ingredienteId: z.string().min(1),
  ubicacion: ubicacionSchema,
  cantidad: z.number().min(0),
  minimo: z.number().min(0).nullable().default(null),
  caducaEn: fechaIsoSchema.nullable().default(null),
});
export type ItemDespensa = z.infer<typeof itemDespensaSchema>;

export const movimientoSchema = z.object({
  ingredienteId: z.string().min(1),
  ubicacion: ubicacionSchema,
  delta: z.number().refine((n) => n !== 0, "El movimiento no puede ser cero"),
  /**
   * Solo al deshacer: caducidad que debe recuperar la fila al volver a tener stock. Que el campo
   * esté presente (aunque sea null) indica que es un deshacer, que puede añadir stock a una fila
   * con stock caducado porque está restituyendo lo que había.
   */
  restaurarCaducidad: fechaIsoSchema.nullable().optional(),
});
export type Movimiento = z.infer<typeof movimientoSchema>;

/** Un movimiento ya aplicado: recuerda la caducidad que tenía la fila antes, para poder deshacerlo. */
export type MovimientoAplicado = Movimiento & { caducaAntes: FechaIso | null };

/** Una comida elegida del menú: qué plato, para cuántas raciones de adulto y cómo se llama en la lista. */
export interface ComidaPlanificada {
  /** Texto para el motivo en la lista: «Cena del martes». */
  etiqueta: string;
  fecha: FechaIso;
  plato: Plato;
  /** Suma de los factores de ración de quienes comen (adulto = 1, niña = 0,5...). */
  raciones: number;
}

export const personaSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  tipo: z.enum(["adulto", "nino"]),
  activa: z.boolean().default(true),
  /** 1 para un adulto; menos para quien come menos (D-012). */
  factorRacion: z.number().positive().max(2).default(1),
});
export type Persona = z.infer<typeof personaSchema>;

export const cargaSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  tipo: z.enum(["cena", "compra", "tarea", "cole", "otro"]),
  /** Minutos de ejecutarla una vez. */
  esfuerzoMin: z.number().int().min(1).max(480),
  /** Minutos semanales de trabajo invisible (acordarse, decidir, organizar): lo hace quien es responsable. */
  planificacionMin: z.number().int().min(0).max(480).default(0),
  responsableId: z.string().nullable().default(null),
  activa: z.boolean().default(true),
});
export type Carga = z.infer<typeof cargaSchema>;

export const turnoSchema = z.object({
  cargaId: z.string().min(1),
  fecha: fechaIsoSchema,
  personaId: z.string().min(1),
  estado: z.enum(["pendiente", "hecho", "saltado"]).default("pendiente"),
});
export type Turno = z.infer<typeof turnoSchema>;

/** Suma de factores de ración de quienes comen (ver D-012). */
export function racionesDe(comensales: ReadonlyArray<Pick<Persona, "factorRacion">>): number {
  return comensales.reduce((suma, p) => suma + p.factorRacion, 0);
}
