import { z } from "zod";
import { type ProyeccionCalendario } from "./calendario-suscrito";
import { type FechaIso, sumarDias } from "./fechas";

/**
 * Alexa (D-214): una skill propia con tres cosas, «añade X a la compra», «qué hay de cena» y «qué
 * tengo hoy». Esto es lo puro: leer la petición de Alexa y decidir qué contesta. Sin red ni base de
 * datos. Por privacidad solo habla de la compra, la cena y las citas: nunca Mi día, objetivos,
 * notas ni medicación.
 */

const intencion = z.object({
  name: z.string(),
  slots: z.record(z.string(), z.object({ value: z.string().optional() }).passthrough()).optional(),
});

/** Lo que importa de lo que manda Alexa (el resto se ignora). */
export const peticionAlexaSchema = z.object({
  version: z.string().optional(),
  session: z
    .object({
      application: z.object({ applicationId: z.string() }),
      attributes: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  context: z
    .object({ System: z.object({ application: z.object({ applicationId: z.string() }) }) })
    .optional(),
  request: z.object({
    type: z.string(),
    requestId: z.string().optional(),
    timestamp: z.string().optional(),
    intent: intencion.optional(),
  }),
});
export type PeticionAlexa = z.infer<typeof peticionAlexaSchema>;

/** El identificador de la skill que la manda (para no contestar a skills ajenas). */
export const skillDe = (p: PeticionAlexa): string | null =>
  p.context?.System.application.applicationId ?? p.session?.application.applicationId ?? null;

export interface RespuestaAlexa {
  version: "1.0";
  sessionAttributes?: Record<string, unknown>;
  response: {
    outputSpeech: { type: "PlainText"; text: string };
    shouldEndSession: boolean;
    reprompt?: { outputSpeech: { type: "PlainText"; text: string } };
  };
}

export const respuesta = (
  texto: string,
  seguir = false,
  opciones: { atributos?: Record<string, unknown>; repregunta?: string } = {},
): RespuestaAlexa => ({
  version: "1.0",
  ...(opciones.atributos ? { sessionAttributes: opciones.atributos } : {}),
  response: {
    outputSpeech: { type: "PlainText", text: texto },
    shouldEndSession: !seguir,
    ...(seguir
      ? {
          reprompt: {
            outputSpeech: {
              type: "PlainText",
              text:
                opciones.repregunta ??
                "Puedes decir: añade leche, qué hay de cena o qué tengo hoy.",
            },
          },
        }
      : {}),
  },
});

/** Hoy según la app: el día cambia a las 4:00 (D-201), en hora de Madrid. */
export const hoyParaAlexa = (ahora: Date = new Date()): FechaIso =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(
    new Date(ahora.getTime() - 4 * 3_600_000),
  );

const MAX_PRODUCTOS = 5;

/**
 * Lo que Alexa entendió como producto, limpio y separado: «leche y pan» son dos; se quita «a la
 * compra» si se coló en lo dicho. Como mucho cinco de una vez.
 */
export function productosDe(dicho: string | undefined): string[] {
  if (!dicho) return [];
  const limpio = dicho
    .toLowerCase()
    .replace(/\s+(a|en)\s+(la\s+)?(lista(\s+de\s+la\s+compra)?|compra)\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return limpio
    .split(/\s*,\s*|\s+y\s+/u)
    .map((x) => x.replace(/^(un|una|unos|unas|el|la|los|las|algo de|más)\s+/u, "").trim())
    .filter((x) => x.length > 0 && x.length <= 80)
    .slice(0, MAX_PRODUCTOS);
}

export const lista = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

/** Lo que se dice tras intentar apuntar los productos (el resultado de cada uno, en orden). */
export function hablarDeLaCompra(
  productos: readonly string[],
  resultados: ReadonlyArray<string | null>,
): string {
  const hechos = productos.filter((_, i) => resultados[i] === "ok");
  if (resultados.some((r) => r === "demasiadas")) {
    return hechos.length > 0
      ? `He apuntado ${lista(hechos)}, pero hoy ya has pedido muchas cosas. Lo demás, desde la app.`
      : "Hoy ya has pedido muchas cosas por voz. El resto, apúntalo desde la app.";
  }
  if (hechos.length === 0) return "No he podido apuntarlo. Prueba otra vez o hazlo desde la app.";
  return `Apuntado en la compra: ${lista(hechos)}.`;
}

/** La cena de hoy, y la comida del cole si hay. */
export function hablarDeLaCena(p: ProyeccionCalendario, hoy: FechaIso): string {
  const cenas = p.cenas.filter((c) => c.fecha === hoy).map((c) => c.nombre);
  const cole = (p.cole ?? []).find((c) => c.fecha === hoy);
  const delCole = [cole?.primero, cole?.segundo].filter((x): x is string => Boolean(x?.trim()));
  const partes: string[] = [];
  partes.push(cenas.length > 0 ? `Hoy de cena: ${lista(cenas)}.` : "Hoy no hay cena apuntada.");
  if (delCole.length > 0) partes.push(`En el cole han comido ${lista(delCole)}.`);
  return partes.join(" ");
}

const hablaDeLaHora = (hora: string | null): string =>
  hora ? ` a las ${hora.replace(/^0/, "")}` : "";

/** Las citas y fechas señaladas de un día (solo eso, nada personal). */
export function hablarDeDia(
  p: ProyeccionCalendario,
  dia: FechaIso,
  tiene: string,
  nada: string,
): string {
  const citas = p.agenda
    .filter((a) => a.fecha <= dia && (a.hasta ?? a.fecha) >= dia)
    .sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99"))
    .map((a) => `${a.titulo}${hablaDeLaHora(a.hora)}`);
  const señalada = p.eventos[dia]?.titulo;
  const todo = [...(señalada ? [señalada] : []), ...citas];
  return todo.length === 0 ? nada : `${tiene} ${lista(todo)}.`;
}

/** Las citas de hoy. */
export const hablarDeHoy = (p: ProyeccionCalendario, hoy: FechaIso): string =>
  hablarDeDia(p, hoy, "Hoy tienes", "Hoy no tienes nada apuntado.");

/** Mañana, por si se pide («qué tengo mañana»). */
export const mananaDe = (hoy: FechaIso): FechaIso => sumarDias(hoy, 1);

export const AYUDA =
  "Puedes decir: añade leche, apunta el jueves a las seis el dentista, ya he hecho la colada, qué hay de cena, qué tengo mañana, qué se lleva al cole o dame el resumen. ¿Qué quieres?";
export const BIENVENIDA = "Hola, soy Conchi. ¿Qué apunto, o qué quieres saber?";
export const SIN_DATOS =
  "Ahora mismo no consigo ver los datos de la casa. Inténtalo en un rato o mira la app.";
