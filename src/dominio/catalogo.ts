import { z } from "zod";
import { grupoPlatoSchema } from "./menu";
import { ingredienteDePlatoSchema, unidadSchema, seccionSchema } from "./tipos";

/**
 * Catálogo de platos de la familia: validación de lo que se escribe a mano. Las mismas reglas que
 * la base de datos (`plato`, `plato_ingrediente`) para que lo que pasa aquí también valga allí.
 * Los avisos reproducen los de la moderación del catálogo comunitario (D-019): quien crea un plato
 * ya ve lo que vería quien lo revisa.
 */

/** Minúsculas y sin tildes: «Pollo» y «pollo» son el mismo ingrediente. */
export const normalizarNombre = (t: string): string =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export const platoEditableSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre necesita al menos 2 letras")
    .max(120, "El nombre es demasiado largo"),
  grupo: grupoPlatoSchema,
  minutosActivos: z
    .number({ error: "Indica los minutos de trabajo" })
    .int("Los minutos deben ser un número entero")
    .min(1, "Mínimo 1 minuto")
    .max(240, "Máximo 240 minutos"),
  pasos: z.string().max(4000, "Los pasos son demasiado largos").nullable(),
  ingredientes: z
    .array(ingredienteDePlatoSchema)
    .min(1, "Añade al menos un ingrediente")
    .max(40, "Demasiados ingredientes"),
});
export type PlatoEditable = z.infer<typeof platoEditableSchema>;

export type ResultadoValidacion =
  { ok: true; valor: PlatoEditable } | { ok: false; errores: string[] };

/** Valida un plato escrito a mano. `ingredientesConocidos` son los ids que existen en el catálogo. */
export function validarPlato(
  entrada: unknown,
  ingredientesConocidos: ReadonlySet<string>,
): ResultadoValidacion {
  const r = platoEditableSchema.safeParse(entrada);
  if (!r.success) return { ok: false, errores: [...new Set(r.error.issues.map((i) => i.message))] };
  const errores: string[] = [];
  const vistos = new Set<string>();
  for (const ing of r.data.ingredientes) {
    if (!ingredientesConocidos.has(ing.ingredienteId))
      errores.push("Hay un ingrediente que no existe");
    if (vistos.has(ing.ingredienteId)) errores.push("Un ingrediente está repetido");
    vistos.add(ing.ingredienteId);
  }
  if (r.data.ingredientes.every((i) => i.opcional))
    errores.push("Al menos un ingrediente debe ser obligatorio");
  return errores.length > 0
    ? { ok: false, errores: [...new Set(errores)] }
    : { ok: true, valor: r.data };
}

export const ingredienteNuevoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre necesita al menos 2 letras")
    .max(60, "El nombre es demasiado largo"),
  unidad: unidadSchema,
  seccion: seccionSchema,
});
export type IngredienteNuevo = z.infer<typeof ingredienteNuevoSchema>;

/** Avisos de calidad (no bloquean): lo que una persona que revisa el plato señalaría. */
export function avisosDePlato(plato: { pasos: string | null; minutosActivos: number }): string[] {
  const avisos: string[] = [];
  if (!plato.pasos || plato.pasos.trim() === "") avisos.push("Sin pasos: añade cómo se hace.");
  if (plato.minutosActivos > 45)
    avisos.push("Más de 45 minutos de trabajo: no es un plato rápido.");
  if (plato.pasos && /https?:\/\/|www\./i.test(plato.pasos)) {
    avisos.push("Los pasos llevan un enlace: escribe la receta con tus palabras.");
  }
  return avisos;
}
