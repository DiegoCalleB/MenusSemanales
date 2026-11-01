import { z } from "zod";
import type { FechaIso } from "./fechas";
import { type GrupoPlato, type MenuCole, grupoPlatoSchema } from "./menu";

/**
 * Lectura del menú mensual del cole a partir de su texto (copiado del PDF). Es un lector
 * determinista: no inventa nada. Lo que no entiende se marca en `avisos` para que una persona lo
 * revise antes de guardar. La lectura con IA desde foto o PDF (D-041) devolverá esta misma forma
 * (`menuColeLeidoSchema`) y pasará por la misma revisión humana.
 */

export const diaColeSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  primero: z.string().min(1).nullable(),
  segundo: z.string().min(1).nullable(),
  /** Guarniciones y ensaladas que acompañan al segundo. */
  guarnicion: z.string().nullable(),
  postre: z.string().nullable(),
  /** Kilocalorías del menú del día, si el cole las publica. */
  kcal: z.number().nullable().optional(),
  grupoPrimero: grupoPlatoSchema.nullable(),
  grupoSegundo: grupoPlatoSchema.nullable(),
});
export type DiaCole = z.infer<typeof diaColeSchema>;

export const menuColeLeidoSchema = z.object({
  anio: z.number().int(),
  mes: z.number().int().min(1).max(12),
  dias: z.array(diaColeSchema),
  avisos: z.array(z.string()),
});
export type MenuColeLeido = z.infer<typeof menuColeLeidoSchema>;

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Palabras que identifican el grupo. Se elige la que aparece antes en el texto (el nombre del
 * plato manda: «Macarrones a la boloñesa de lentejas» es pasta), y a igual posición la más larga.
 */
const PALABRAS: ReadonlyArray<readonly [GrupoPlato, readonly string[]]> = [
  [
    "verdura",
    [
      "albondigas vegetales",
      "judias verdes",
      "crema",
      "brocoli",
      "ensalada",
      "menestra",
      "verduras",
      "coliflor",
      "calabacin",
      "espinacas",
      "acelgas",
      "puerro",
    ],
  ],
  ["legumbre", ["lentejas", "garbanzo", "alubia", "judias", "potaje", "cocido", "guisantes"]],
  [
    "pasta",
    [
      "macarrones",
      "zuccaroni",
      "espaguetis",
      "fideos",
      "tallarines",
      "pasta",
      "sopa",
      "canelones",
      "lasana",
      "estrellitas",
    ],
  ],
  ["arroz", ["arroz", "paella"]],
  ["huevo", ["tortilla", "huevo", "revuelto"]],
  [
    "pescado",
    [
      "merluza",
      "dorado",
      "bacaladilla",
      "abadejo",
      "caballa",
      "salmon",
      "atun",
      "bacalao",
      "pescado",
      "lenguado",
      "gallo",
      "pescadilla",
      "calamar",
      "sardina",
      "trucha",
      "lubina",
    ],
  ],
  [
    "carne",
    [
      "pollo",
      "lomo",
      "ternera",
      "magro",
      "pavo",
      "albondigas",
      "jamoncitos",
      "jamon",
      "filete",
      "hamburguesa",
      "chorizo",
      "chistorra",
      "cerdo",
      "cinta",
      "salchicha",
      "cordero",
      "conejo",
    ],
  ],
];

/** Grupo de un plato a partir de su nombre, o null si no se reconoce (hay que revisarlo). */
export function clasificarPlato(texto: string): GrupoPlato | null {
  const t = sinTildes(texto);
  let mejor: { grupo: GrupoPlato; pos: number; largo: number } | null = null;
  for (const [grupo, palabras] of PALABRAS) {
    for (const palabra of palabras) {
      const pos = t.indexOf(palabra);
      if (pos < 0) continue;
      if (!mejor || pos < mejor.pos || (pos === mejor.pos && palabra.length > mejor.largo)) {
        mejor = { grupo, pos, largo: palabra.length };
      }
    }
  }
  return mejor?.grupo ?? null;
}

const ES_PAN = /^pan(\s|$)/i;
const ES_POSTRE = /^(fruta|yogur|natillas|flan|cuajada|lacteo|lácteo|queso fresco)/i;
const ES_KCAL = /^kcal\b/i;
const LINEA_DE_DIAS = /^\d{1,2}(\s+\d{1,2})*$/;

function parentesisAbiertos(t: string): boolean {
  return (t.match(/\(/g)?.length ?? 0) > (t.match(/\)/g)?.length ?? 0);
}

/** Une las líneas que el PDF ha partido por el ancho de la celda. */
function unirContinuaciones(lineas: readonly string[]): string[] {
  const salida: string[] = [];
  for (const linea of lineas) {
    const anterior = salida[salida.length - 1];
    const continua =
      anterior !== undefined &&
      (parentesisAbiertos(anterior) ||
        /(\s(y|de|con|o|en|a la)|,)$/i.test(anterior) ||
        /^\p{Ll}/u.test(linea));
    if (continua) salida[salida.length - 1] = `${anterior} ${linea}`;
    else salida.push(linea);
  }
  return salida;
}

function fechaIso(anio: number, mes: number, dia: number): FechaIso | null {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null; // 31 de noviembre, etc.
  return d.toISOString().slice(0, 10);
}

/**
 * Lee el texto del menú mensual. El mes y el año salen del título («MENÚ … Noviembre 2026») o se
 * pasan en `por defecto`. Días sin menú (festivos) se omiten.
 */
export function leerMenuCole(
  texto: string,
  porDefecto?: { anio: number; mes: number },
): MenuColeLeido {
  const avisos: string[] = [];
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l !== "");

  let anio = porDefecto?.anio;
  let mes = porDefecto?.mes;
  const titulo = lineas
    .slice(0, 5)
    .map((l) => /(\p{L}+)\s+(20\d{2})\b/u.exec(l))
    .find((m) => m && MESES.includes(sinTildes(m[1] ?? "")));
  if (titulo) {
    mes = MESES.indexOf(sinTildes(titulo[1] ?? "")) + 1;
    anio = Number(titulo[2]);
  }
  if (!anio || !mes) {
    return {
      anio: anio ?? 0,
      mes: mes ?? 1,
      dias: [],
      avisos: [
        "No encuentro el mes y el año. Pega también el título del menú (p. ej. «Noviembre 2026»).",
      ],
    };
  }

  // Bloques: cada línea de números abre el día (o los días vacíos y uno con contenido).
  const bloques: Array<{ dia: number; lineas: string[]; kcal?: number }> = [];
  let actual: { dia: number; lineas: string[]; kcal?: number } | null = null;
  const cerrar = () => {
    if (actual) bloques.push(actual);
    actual = null;
  };
  for (const linea of lineas) {
    if (LINEA_DE_DIAS.test(linea)) {
      cerrar();
      const numeros = linea.split(" ").map(Number);
      for (const vacio of numeros.slice(0, -1)) bloques.push({ dia: vacio, lineas: [] });
      actual = { dia: numeros[numeros.length - 1] as number, lineas: [] };
    } else if (actual && !ES_KCAL.test(linea)) {
      (actual as { lineas: string[] }).lineas.push(linea);
    } else if (actual) {
      const m = /kcal:\s*([\d.,]+)/i.exec(linea);
      if (m) (actual as { kcal?: number }).kcal = Number((m[1] ?? "").replace(",", "."));
      cerrar();
    }
  }
  cerrar();

  const dias: DiaCole[] = [];
  for (const { dia, lineas: bruto, kcal } of bloques) {
    if (bruto.length === 0) continue; // sin menú ese día
    const fecha = fechaIso(anio, mes, dia);
    if (!fecha) {
      avisos.push(`El día ${dia} no existe en ${MESES[mes - 1]} de ${anio}: se ignora.`);
      continue;
    }
    const platos = unirContinuaciones(bruto);
    const postres = platos.filter((p) => ES_POSTRE.test(p));
    const resto = platos.filter((p) => !ES_PAN.test(p) && !ES_POSTRE.test(p));
    const [primero = null, segundo = null, ...guarniciones] = resto;
    if (!segundo) avisos.push(`${fecha}: solo he encontrado un plato; revisa si falta el segundo.`);
    const grupoPrimero = primero ? clasificarPlato(primero) : null;
    const grupoSegundo = segundo ? clasificarPlato(segundo) : null;
    if (primero && !grupoPrimero)
      avisos.push(`${fecha}: no sé clasificar «${primero}»; elige su grupo.`);
    if (segundo && !grupoSegundo)
      avisos.push(`${fecha}: no sé clasificar «${segundo}»; elige su grupo.`);
    dias.push({
      fecha,
      primero,
      segundo,
      guarnicion: guarniciones.length > 0 ? guarniciones.join(" · ") : null,
      postre: postres[0] ?? null,
      kcal: kcal !== undefined && Number.isFinite(kcal) ? Math.round(kcal) : null,
      grupoPrimero,
      grupoSegundo,
    });
  }

  dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (dias.length === 0) avisos.push("No he encontrado ningún día con menú en el texto.");
  return { anio, mes, dias, avisos };
}

/** Convierte los días leídos (ya revisados) en el menú que usa el motor. */
export function aMenuCole(dias: readonly DiaCole[]): Record<FechaIso, MenuCole> {
  const salida: Record<FechaIso, MenuCole> = {};
  for (const d of dias) {
    salida[d.fecha] = {
      primero: d.grupoPrimero,
      segundo: d.grupoSegundo,
      textoPrimero: d.primero,
      textoSegundo: d.segundo,
      postre: d.postre,
      kcal: d.kcal ?? null,
    };
  }
  return salida;
}
