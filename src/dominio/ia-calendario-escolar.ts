import { z } from "zod";
import type { CalendarioLeido } from "./calendario-escolar";

/**
 * Leer el calendario escolar oficial con IA (D-146). La IA solo saca datos; lo que vale lo decide
 * `validarCurso` y que dos lecturas seguidas coincidan.
 */

export const INSTRUCCIONES_CALENDARIO_ESCOLAR = `Eres un asistente que extrae datos de documentos oficiales.
Te paso el calendario escolar oficial de la Comunidad de Madrid (la orden del BOCM y, si está, el
cuadro resumen en colores). Extrae SOLO lo que aplica a «segundo ciclo de Educación Infantil y
Educación Primaria» en centros sostenidos con fondos públicos:
- inicio: primer día de actividades lectivas (AAAA-MM-DD).
- fin: último día de actividades lectivas (AAAA-MM-DD).
- periodos: las vacaciones de Navidad y de Semana Santa, con su primer y último día (ambos incluidos).
- dias: todos los demás días festivos y «otros días no lectivos» entre el inicio y el fin, uno a
  uno, con un motivo corto en español («Día de la Constitución», «Día no lectivo»). Incluye los
  festivos nacionales y de la Comunidad de Madrid del segundo año si aparecen en algún documento.
No incluyas fiestas locales de ningún municipio, ni días de jornada reducida, ni nada de escuelas
infantiles de primer ciclo, secundaria o adultos. No inventes nada: si un dato no está, déjalo fuera.`;

export const mensajeCalendarioEscolar = (anio: number) =>
  `Curso ${anio}/${anio + 1}. Devuelve el JSON pedido.`;

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// El motivo solo se enseña: si viene largo se recorta (luego se deja en 60), no se rechaza todo.
const motivo = z
  .string()
  .trim()
  .min(1)
  .transform((t) => t.slice(0, 120));

export const respuestaCalendarioEscolarSchema = z.object({
  inicio: fecha,
  fin: fecha,
  periodos: z.array(z.object({ desde: fecha, hasta: fecha, motivo })).max(12),
  dias: z.array(z.object({ fecha, motivo })).max(60),
});

export type RespuestaCalendarioEscolar = z.infer<typeof respuestaCalendarioEscolarSchema>;

export const aLeido = (r: RespuestaCalendarioEscolar): CalendarioLeido => r;
