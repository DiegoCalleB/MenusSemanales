/**
 * La lista de la compra de verdad no son solo ingredientes de recetas: es leche, pañales, cervezas,
 * papel higiénico y comida de los gatos. Este módulo entiende lo que se escribe o se dicta: lo parte
 * en artículos, lo clasifica por sección del súper y propone «lo de siempre».
 *
 * Los habituales salen de la lista de la compra histórica de la familia (2026-11-02): los
 * artículos que más se repetían en años de listas.
 */

export const CATEGORIAS = [
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
  "higiene",
  "mascotas",
  "otros",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const NOMBRE_CATEGORIA: Record<Categoria, { nombre: string; emoji: string }> = {
  fruta_verdura: { nombre: "Fruta y verdura", emoji: "🥦" },
  panaderia: { nombre: "Panadería", emoji: "🍞" },
  carne: { nombre: "Carne y charcutería", emoji: "🥩" },
  pescado: { nombre: "Pescado", emoji: "🐟" },
  lacteos: { nombre: "Lácteos", emoji: "🥛" },
  huevos: { nombre: "Huevos", emoji: "🥚" },
  conservas: { nombre: "Conservas", emoji: "🥫" },
  despensa: { nombre: "Despensa", emoji: "🍝" },
  congelados: { nombre: "Congelados", emoji: "🧊" },
  bebidas: { nombre: "Bebidas", emoji: "🥤" },
  limpieza: { nombre: "Limpieza y hogar", emoji: "🧴" },
  higiene: { nombre: "Higiene y bebé", emoji: "🧼" },
  mascotas: { nombre: "Mascotas", emoji: "🐱" },
  otros: { nombre: "Otros", emoji: "🛒" },
};

const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
export const claveArticulo = normalizar;

/** Palabras clave por categoría; la primera categoría que coincide gana (más específicas primero). */
const REGLAS: ReadonlyArray<readonly [Categoria, RegExp]> = [
  ["mascotas", /\bgato|\bgatos|pienso|arena (verde|gato)|premios/],
  [
    "higiene",
    /panal|toallit|tissue|papel higienico|pasta de dientes|cepillo|champu|acondicionador|mascarilla|gel\b|desodorante|crema (cara|sol|solar|nivea|calm|del cuerpo|para el cuerpo)|jabon|bastoncillos|discos desmaquill|espuma de afeitar|papilla|tiritas|algodon|colonia|spray pelo|arco dental/,
  ],
  [
    "limpieza",
    /detergente|lavavajillas|friegasuelos|friega suelos|bolsas? (de )?basura|papel (de )?cocina|rollos de papel|estropajo|ambientador|escoba|recogedor|fregona|lejia|suavizante|desinfectante|papel film|film|papel horno|pilas?\b|bombilla|sal (para )?lavavajillas|abrillantador|trapo|guantes|flash|liquido (azul|tejidos)|eliminador olores|cubo limpieza|spray madera|antihumedad/,
  ],
  [
    "bebidas",
    /cerveza|cocacola|coca-?cola|coca cola|fanta|limonada|tonica|gin\b|tanqueray|tinto de verano|agua\b|refresco|vino|zumo|hielos|infusion|ladron de manzanas|bebida/,
  ],
  ["congelados", /congelad|helado|pizza|lasana|palitos de verduras/],
  ["huevos", /\bhuevos?\b/],
  [
    "lacteos",
    /leche|yogur|kefir|queso|quesito|cubiquesos|cuby|mantequilla|margarina|nata\b|natillas|mozzarella|gelatina|cuajada/,
  ],
  [
    "pescado",
    /pescado|salmon|lubina|merluza|atun|bocarte|gamba|sepia|calamar|bacalao|pulpo|dorada/,
  ],
  [
    "carne",
    /pollo|pavo|lomo|ternera|cerdo|carne|salchicha|fuet|chorizo|jamon|bacon|embutido|salchichon|charcuteria|hamburguesa|costilla/,
  ],
  [
    "panaderia",
    /\bpan\b|pan de|panecillo|piadina|tortita|croissant|cruasan|bimbo|regana|picos|bizcocho|tostad|empanada|empanadilla|obleas|fajitas?|tortilla de trigo|tortitas/,
  ],
  [
    "conservas",
    /conserva|tomate frito|garbanzos|lentejas|maiz|aceitunas|guacamole|hummus|humus|salsa|mermelada|nocilla|crema lotus|crema lotu/,
  ],
  [
    "fruta_verdura",
    /fruta|platano|manzana|naranja|mandarina|limon|pera\b|peras|uvas|fresas?|arandano|cereza|melocoton|sandia|melon|kiwi|aguacate|tomate|lechuga|cebolla|ajos?\b|zanahoria|berenjena|coliflor|judias verdes|calabac|calabaza|patata|pimiento|espinaca|brocoli|ensalada|jengibre|albahaca|oregano fresco|verdura|champinon/,
  ],
  [
    "despensa",
    /arroz|pasta|fideos|cuscus|harina|azucar|sal\b|aceite|vinagre|cafe|cacao|cereales|galletas?|chocolate|choco|chispas|pasas|frutos secos|almendras|miel|levadura|copos|curry|comino|canela|curcuma|oregano|picoteo|patatas fritas|nachos|chuches|chicles|bombones|lacasitos|mikado|digestive|obleas|infusion|esencia|sopa|crema de calabaza|cremas? calabaza|gelatina|pepitas|decoraciones|sandy|maiz/,
  ],
];

/** Sección del súper de un artículo escrito a mano; «otros» si no se reconoce. */
export function clasificarArticulo(nombre: string): Categoria {
  const n = normalizar(nombre);
  for (const [categoria, regla] of REGLAS) if (regla.test(n)) return categoria;
  return "otros";
}

const MAX_ARTICULOS = 20;
export const MAX_LARGO_ARTICULO = 80;

/**
 * Parte lo escrito o dictado en artículos: «leche, huevos y pan» → Leche, Huevos, Pan. Separa por
 * comas, punto y coma, saltos de línea y « y » (al dictar se dice «leche y pan», no se pone coma).
 */
export function partirDictado(texto: string): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const crudo of texto.split(/[,;\n]| y (?=\S)/i)) {
    const limpio = crudo
      .replace(/\s+/g, " ")
      .replace(/^[\s\-–•*☐✓]+/, "")
      .trim();
    if (limpio === "") continue;
    const nombre = limpio.charAt(0).toUpperCase() + limpio.slice(1);
    const clave = normalizar(nombre);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(nombre);
    if (salida.length >= MAX_ARTICULOS) break;
  }
  return salida;
}

/** «Lo de siempre»: los artículos que más se repetían en la lista de la compra histórica. */
export const HABITUALES: readonly string[] = [
  "Leche",
  "Pan",
  "Huevos",
  "Yogures",
  "Kéfir",
  "Fruta",
  "Plátanos",
  "Manzanas",
  "Arándanos",
  "Tomates",
  "Aguacate",
  "Lechuga",
  "Pollo",
  "Pavo",
  "Queso lonchas",
  "Queso rallado",
  "Fuet",
  "Piadinas",
  "Pañales",
  "Tissues",
  "Papel higiénico",
  "Pasta de dientes",
  "Cervezas",
  "Coca-Cola",
  "Patatas fritas",
  "Galletas",
  "Salchichas",
  "Sopa",
  "Crema de calabaza",
  "Berenjena",
  "Judías verdes",
  "Coliflor",
  "Lubina",
  "Salmón",
  "Filetes de lomo",
  "Hummus",
  "Mandarinas",
  "Naranjas",
  "Limones",
  "Patatas",
  "Pasta fresca",
  "Pan rallado",
  "Papilla",
  "Latas de gatos",
  "Detergente lavadora",
  "Lavavajillas",
  "Papel de cocina",
  "Bolsas de basura",
  "Tortitas",
  "Guacamole",
  "Gelatinas",
  "Jamón",
  "Atún",
  "Pasas",
  "Hielos",
  "Harina",
  "Mantequilla",
  "Cebollas",
  "Zanahorias",
  "Sandía",
  "Fresas",
  "Arroz",
  "Café",
  "Aceite de oliva",
  "Agua",
  "Tomate frito",
  "Nachos",
  "Empanadillas",
  "Croissants",
  "Regañas",
  "Cereales",
  "Chocolate",
];

/** Habituales que aún no están en la lista y que coinciden con lo que se va escribiendo. */
export function sugerencias(texto: string, yaEnLista: ReadonlySet<string>, maximo = 6): string[] {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  return HABITUALES.filter((h) => {
    const n = normalizar(h);
    return !yaEnLista.has(n) && (n.startsWith(q) || n.split(" ").some((p) => p.startsWith(q)));
  }).slice(0, maximo);
}

/** Los habituales agrupados por sección del súper, en el orden de la tienda: para repasar la despensa. */
export function habitualesPorCategoria(): Array<{ categoria: Categoria; articulos: string[] }> {
  const grupos = new Map<Categoria, string[]>();
  for (const h of HABITUALES) {
    const c = clasificarArticulo(h);
    grupos.set(c, [...(grupos.get(c) ?? []), h]);
  }
  return CATEGORIAS.filter((c) => grupos.has(c)).map((c) => ({
    categoria: c,
    articulos: grupos.get(c) ?? [],
  }));
}
