import { aMenuCole, leerMenuCole } from "@/dominio/menu-cole";
import { TEXTO_MENU_COLE_NOVIEMBRE_2026 } from "@/dominio/menu-cole-ejemplo";
import type { GrupoPlato, PlatoMenu } from "@/dominio/menu";
import type { Carga, Ingrediente, Persona, Seccion, Unidad } from "@/dominio/tipos";
import type { Ocurrencia } from "@/dominio/reparto";
import type { EstadoHogar } from "./estado";

/**
 * «Modo Diego»: los datos reales de la familia de Diego, para probar la app con lo que de verdad
 * cocinan. Salen de lo que Diego ha contado y de las capturas de su app anterior
 * (docs/contexto/app-anterior-*.jpg) y del menú real del cole.
 *
 * Lo que SÍ es real: las personas, los nombres de los platos, el menú del cole y el cumpleaños.
 * Lo que es ESTIMADO (y los platos van marcados «por revisar»): los ingredientes, las cantidades y
 * los tiempos de cada plato, porque las capturas solo traen el nombre. No hay despensa: no la
 * conocemos todavía.
 */

type I = readonly [id: string, nombre: string, unidad: Unidad, seccion: Seccion];
const INGREDIENTES: readonly I[] = [
  ["pollo", "Pechuga de pollo", "g", "carne"],
  ["ternera-picada", "Ternera picada", "g", "carne"],
  ["filete-ternera", "Filete de ternera", "g", "carne"],
  ["ternera-guiso", "Ternera para guisar", "g", "carne"],
  ["solomillo", "Solomillo de cerdo", "g", "carne"],
  ["lomo", "Lomo de cerdo", "g", "carne"],
  ["costillas", "Costillas", "g", "carne"],
  ["bacon", "Bacon", "g", "carne"],
  ["salchichas", "Salchichas", "ud", "carne"],
  ["chorizo", "Chorizo", "g", "carne"],
  ["jamon", "Jamón", "g", "carne"],
  ["sepia", "Sepia", "g", "pescado"],
  ["gulas", "Gulas", "g", "pescado"],
  ["merluza", "Merluza", "g", "pescado"],
  ["salmon", "Salmón", "g", "pescado"],
  ["lubina", "Lubina", "g", "pescado"],
  ["atun", "Atún en lata", "ud", "conservas"],
  ["huevo", "Huevos", "ud", "huevos"],
  ["queso", "Queso", "g", "lacteos"],
  ["mozzarella", "Mozzarella", "g", "lacteos"],
  ["leche", "Leche", "ml", "lacteos"],
  ["nata", "Nata para cocinar", "ml", "lacteos"],
  ["tomate", "Tomate", "g", "fruta_verdura"],
  ["pimiento", "Pimiento", "g", "fruta_verdura"],
  ["cebolla", "Cebolla", "g", "fruta_verdura"],
  ["patata", "Patata", "g", "fruta_verdura"],
  ["zanahoria", "Zanahoria", "g", "fruta_verdura"],
  ["calabacin", "Calabacín", "g", "fruta_verdura"],
  ["calabaza", "Calabaza", "g", "fruta_verdura"],
  ["berenjena", "Berenjena", "g", "fruta_verdura"],
  ["coliflor", "Coliflor", "g", "fruta_verdura"],
  ["judias-verdes", "Judías verdes", "g", "fruta_verdura"],
  ["guisantes", "Guisantes", "g", "congelados"],
  ["espinacas", "Espinacas", "g", "fruta_verdura"],
  ["champinones", "Champiñones", "g", "fruta_verdura"],
  ["lechuga", "Lechuga", "g", "fruta_verdura"],
  ["aguacate", "Aguacate", "ud", "fruta_verdura"],
  ["pan", "Pan", "ud", "panaderia"],
  ["pan-rallado", "Pan rallado", "g", "despensa"],
  ["tortillas", "Tortillas de trigo", "ud", "panaderia"],
  ["hojaldre", "Hojaldre", "ud", "panaderia"],
  ["harina", "Harina", "g", "despensa"],
  ["pasta", "Pasta", "g", "despensa"],
  ["arroz", "Arroz", "g", "despensa"],
  ["cuscus", "Cuscús", "g", "despensa"],
  ["lentejas", "Lentejas", "g", "despensa"],
  ["garbanzos", "Garbanzos cocidos", "g", "conservas"],
  ["tomate-frito", "Tomate frito", "ml", "conservas"],
  ["croquetas", "Croquetas", "ud", "congelados"],
  ["empanadillas", "Empanadillas", "ud", "congelados"],
  ["piadinas", "Piadinas", "ud", "panaderia"],
];

type Ing = readonly [id: string, cantidadPorRacion: number];
type P = readonly [
  id: string,
  nombre: string,
  grupo: GrupoPlato,
  minutos: number,
  ingredientes: readonly Ing[],
];
/** Los platos que Diego listó en su app anterior (capturas), con ingredientes y tiempos estimados. */
const PLATOS: readonly P[] = [
  ["sepia", "Sepia", "pescado", 15, [["sepia", 150]]],
  [
    "gulas",
    "Gulas",
    "pescado",
    10,
    [
      ["gulas", 80],
      ["pan", 0.5],
    ],
  ],
  ["champinones", "Champiñones", "verdura", 10, [["champinones", 200]]],
  [
    "tomates-rellenos",
    "Tomates rellenos",
    "verdura",
    25,
    [
      ["tomate", 250],
      ["ternera-picada", 60],
      ["cebolla", 30],
    ],
  ],
  ["filetes-ternera", "Filetes de ternera", "carne", 10, [["filete-ternera", 130]]],
  ["solomillitos", "Solomillitos", "carne", 15, [["solomillo", 130]]],
  [
    "solomillo-bacon-queso",
    "Solomillo con bacon y queso",
    "carne",
    20,
    [
      ["solomillo", 130],
      ["bacon", 30],
      ["queso", 30],
    ],
  ],
  [
    "hamburguesas-ternera",
    "Hamburguesas de ternera",
    "carne",
    15,
    [
      ["ternera-picada", 110],
      ["pan", 1],
    ],
  ],
  [
    "hamburguesas-pollo",
    "Hamburguesas de pollo",
    "carne",
    15,
    [
      ["pollo", 110],
      ["pan", 1],
    ],
  ],
  [
    "arroz-pollo-curry",
    "Arroz con pollo al curry",
    "arroz",
    25,
    [
      ["arroz", 70],
      ["pollo", 100],
      ["cebolla", 30],
      ["nata", 30],
    ],
  ],
  [
    "judias-verdes",
    "Judías verdes",
    "verdura",
    15,
    [
      ["judias-verdes", 200],
      ["patata", 100],
    ],
  ],
  [
    "patatas-ana",
    "Patatas Ana",
    "otro",
    20,
    [
      ["patata", 250],
      ["cebolla", 40],
    ],
  ],
  [
    "milanesa-pollo",
    "Milanesa de pollo",
    "carne",
    20,
    [
      ["pollo", 130],
      ["huevo", 0.5],
      ["pan-rallado", 30],
    ],
  ],
  [
    "garbanzos-saltarines",
    "Garbanzos saltarines",
    "legumbre",
    15,
    [
      ["garbanzos", 120],
      ["espinacas", 60],
    ],
  ],
  [
    "cocido",
    "Cocido",
    "legumbre",
    30,
    [
      ["garbanzos", 100],
      ["ternera-guiso", 60],
      ["patata", 100],
      ["zanahoria", 50],
    ],
  ],
  ["costillas-barbacoa", "Costillas barbacoa", "carne", 15, [["costillas", 250]]],
  [
    "carne-guisada",
    "Carne guisada",
    "carne",
    25,
    [
      ["ternera-guiso", 130],
      ["patata", 100],
      ["zanahoria", 50],
      ["cebolla", 30],
    ],
  ],
  [
    "hojaldre-pollo-barbacoa",
    "Hojaldre de pollo barbacoa",
    "carne",
    25,
    [
      ["pollo", 100],
      ["hojaldre", 0.5],
      ["queso", 20],
    ],
  ],
  [
    "tosta",
    "Tosta",
    "otro",
    10,
    [
      ["pan", 1],
      ["tomate", 60],
      ["jamon", 30],
    ],
  ],
  ["croquetas", "Croquetas", "otro", 20, [["croquetas", 5]]],
  [
    "crema-calabaza",
    "Crema de calabaza",
    "verdura",
    20,
    [
      ["calabaza", 250],
      ["patata", 50],
      ["cebolla", 30],
    ],
  ],
  [
    "crema-calabacin",
    "Crema de calabacín",
    "verdura",
    20,
    [
      ["calabacin", 250],
      ["patata", 50],
      ["cebolla", 30],
    ],
  ],
  [
    "coliflor-salchichas",
    "Coliflor con salchichas",
    "verdura",
    20,
    [
      ["coliflor", 200],
      ["salchichas", 2],
      ["patata", 100],
    ],
  ],
  [
    "guisantes-jamon",
    "Guisantes con jamón",
    "verdura",
    15,
    [
      ["guisantes", 150],
      ["jamon", 40],
    ],
  ],
  [
    "ensalada-aguacate-mozzarella",
    "Ensalada de tomate, aguacate y mozzarella",
    "verdura",
    10,
    [
      ["tomate", 120],
      ["aguacate", 0.5],
      ["mozzarella", 60],
    ],
  ],
  [
    "ensaladilla-rusa",
    "Ensaladilla rusa",
    "otro",
    25,
    [
      ["patata", 150],
      ["zanahoria", 40],
      ["atun", 0.5],
      ["huevo", 0.5],
    ],
  ],
  [
    "pure",
    "Puré de patata",
    "verdura",
    15,
    [
      ["patata", 250],
      ["leche", 50],
    ],
  ],
  ["tortilla-francesa", "Tortilla francesa", "huevo", 10, [["huevo", 2]]],
  [
    "pasta-chorizo",
    "Pasta con chorizo",
    "pasta",
    20,
    [
      ["pasta", 80],
      ["chorizo", 40],
      ["tomate-frito", 60],
    ],
  ],
  [
    "berenjena-rebozada",
    "Berenjena rebozada",
    "verdura",
    25,
    [
      ["berenjena", 200],
      ["huevo", 0.5],
      ["harina", 20],
    ],
  ],
  ["lubina", "Lubina", "pescado", 15, [["lubina", 160]]],
  [
    "salmorejo",
    "Salmorejo",
    "verdura",
    10,
    [
      ["tomate", 300],
      ["pan", 0.5],
    ],
  ],
  [
    "fajitas",
    "Fajitas",
    "carne",
    25,
    [
      ["pollo", 100],
      ["pimiento", 60],
      ["cebolla", 40],
      ["tortillas", 1.5],
    ],
  ],
  [
    "salmon-patatas",
    "Salmón al horno con patatas",
    "pescado",
    15,
    [
      ["salmon", 130],
      ["patata", 150],
    ],
  ],
  [
    "lentejas",
    "Lentejas",
    "legumbre",
    25,
    [
      ["lentejas", 80],
      ["zanahoria", 40],
      ["cebolla", 30],
    ],
  ],
  [
    "huevos-marialuisa",
    "Huevos Marialuisa",
    "huevo",
    20,
    [
      ["huevo", 2],
      ["patata", 100],
    ],
  ],
  [
    "verduras-tempura",
    "Verduras en tempura",
    "verdura",
    25,
    [
      ["calabacin", 100],
      ["zanahoria", 50],
      ["harina", 30],
      ["huevo", 0.5],
    ],
  ],
  [
    "albondigas-arroz",
    "Albóndigas con arroz",
    "carne",
    30,
    [
      ["ternera-picada", 100],
      ["arroz", 60],
      ["tomate-frito", 60],
      ["cebolla", 20],
    ],
  ],
  [
    "cuscus",
    "Cuscús",
    "pasta",
    15,
    [
      ["cuscus", 70],
      ["zanahoria", 40],
      ["calabacin", 60],
    ],
  ],
  [
    "pizza-casera",
    "Pizza casera",
    "otro",
    30,
    [
      ["harina", 120],
      ["tomate-frito", 60],
      ["mozzarella", 60],
      ["jamon", 30],
    ],
  ],
  [
    "sandwich",
    "Sándwich",
    "otro",
    10,
    [
      ["pan", 2],
      ["jamon", 40],
      ["queso", 30],
    ],
  ],
  [
    "pasta-fresca",
    "Pasta fresca",
    "pasta",
    15,
    [
      ["pasta", 120],
      ["tomate-frito", 60],
      ["queso", 15],
    ],
  ],
  ["pollo-frito-freidora", "Pollo frito (freidora de aire)", "carne", 15, [["pollo", 130]]],
  [
    "sopa",
    "Sopa",
    "pasta",
    15,
    [
      ["pasta", 40],
      ["zanahoria", 30],
      ["pollo", 30],
    ],
  ],
  ["filetes-lomo", "Filetes de lomo", "carne", 10, [["lomo", 130]]],
  ["salmon", "Salmón a la plancha", "pescado", 10, [["salmon", 130]]],
  [
    "huevos-fritos-patatas",
    "Huevos fritos con patatas",
    "huevo",
    20,
    [
      ["huevo", 2],
      ["patata", 150],
    ],
  ],
  [
    "piadinas",
    "Piadinas",
    "otro",
    15,
    [
      ["piadinas", 1],
      ["jamon", 40],
      ["queso", 30],
    ],
  ],
  [
    "tortilla-patatas",
    "Tortilla de patatas",
    "huevo",
    30,
    [
      ["huevo", 2],
      ["patata", 150],
      ["cebolla", 30],
    ],
  ],
  ["pollo-plancha", "Pollo a la plancha", "carne", 10, [["pollo", 130]]],
  [
    "onion-baji",
    "Onion bhaji",
    "verdura",
    25,
    [
      ["cebolla", 150],
      ["harina", 30],
    ],
  ],
  ["empanadillas", "Empanadillas", "otro", 15, [["empanadillas", 3]]],
  ["merluza", "Merluza", "pescado", 15, [["merluza", 150]]],
  [
    "ensalada-cesar",
    "Ensalada César",
    "verdura",
    15,
    [
      ["lechuga", 100],
      ["pollo", 80],
      ["queso", 15],
      ["pan", 0.5],
    ],
  ],
];

/** Platos pequeños (sopa, ensalada, guarnición…): se pueden combinar varios en una misma cena. */
const LIGEROS = new Set([
  "champinones",
  "gulas",
  "judias-verdes",
  "guisantes-jamon",
  "pure",
  "tosta",
  "salmorejo",
  "sopa",
  "ensalada-aguacate-mozzarella",
  "ensaladilla-rusa",
  "croquetas",
  "empanadillas",
  "onion-baji",
  "patatas-ana",
]);

export const PERSONAS_DIEGO: Persona[] = [
  { id: "diego", nombre: "Diego", tipo: "adulto", activa: true, factorRacion: 1 },
  { id: "ana", nombre: "Ana", tipo: "adulto", activa: true, factorRacion: 1 },
  { id: "alba", nombre: "Alba", tipo: "nino", activa: true, factorRacion: 0.5 },
  { id: "emma", nombre: "Emma", tipo: "nino", activa: true, factorRacion: 0.5 },
];

const cargas: Carga[] = [
  {
    id: "cenas",
    nombre: "Cenas",
    tipo: "cena",
    esfuerzoMin: 40,
    planificacionMin: 30,
    responsableId: null,
    activa: true,
  },
  {
    id: "compra",
    nombre: "Compra semanal",
    tipo: "compra",
    esfuerzoMin: 60,
    planificacionMin: 45,
    responsableId: null,
    activa: true,
  },
  {
    id: "cole",
    nombre: "Gestiones del cole",
    tipo: "cole",
    esfuerzoMin: 15,
    planificacionMin: 25,
    responsableId: null,
    activa: true,
  },
  {
    id: "basura",
    nombre: "Sacar la basura",
    tipo: "tarea",
    esfuerzoMin: 5,
    planificacionMin: 0,
    responsableId: null,
    activa: true,
  },
  {
    id: "lavadora",
    nombre: "Lavadoras",
    tipo: "tarea",
    esfuerzoMin: 20,
    planificacionMin: 10,
    responsableId: null,
    activa: true,
  },
  {
    id: "sabanas",
    nombre: "Cambio de sábanas",
    tipo: "tarea",
    esfuerzoMin: 30,
    planificacionMin: 0,
    responsableId: null,
    activa: true,
  },
];

/**
 * Tareas de cada uno, de la lista que Ana escribió a mano (2026-11-02, foto en docs/contexto/).
 * Las rutinas de las niñas se repiten cada día; lo demás son tareas puntuales. «Chill out»,
 * «Transportín» y «Cutxa ska» se copian tal cual: no sé exactamente a qué se refieren.
 */
const TAREAS_FAMILIA: ReadonlyArray<readonly [string, "diaria" | "puntual", string]> = [
  ["emma", "diaria", "Dientes"],
  ["emma", "diaria", "Vestir"],
  ["emma", "diaria", "Hacer cama"],
  ["emma", "diaria", "Recoger habitación"],
  ["emma", "puntual", "Recoger manualidades"],
  ["alba", "diaria", "Dientes"],
  ["alba", "diaria", "Vestir"],
  ["alba", "diaria", "Hacer cama"],
  ["alba", "puntual", "Limpiar botella"],
  ["alba", "puntual", "Recoger manualidades"],
  ["alba", "puntual", "Deberes"],
  ["alba", "puntual", "Examen"],
  ["diego", "puntual", "Chill out"],
  ["diego", "puntual", "Transportín"],
  ["diego", "puntual", "Cutxa ska"],
  ["diego", "puntual", "Crema Emma"],
  ["diego", "puntual", "Limpiar cristales"],
  ["diego", "puntual", "Bajar sillas"],
  ["ana", "puntual", "Halloween"],
  ["ana", "puntual", "Ropa"],
  ["ana", "puntual", "Habitación"],
  ["ana", "puntual", "Cocina"],
];

/** Cumpleaños de Ana: sábado 7 de noviembre de 2026. */
export const FECHA_CUMPLE_ANA = "2026-11-07";

export function estadoModoDiego(hoy: string): EstadoHogar {
  const ingredientes: Ingrediente[] = INGREDIENTES.map(([id, nombre, unidad, seccion]) => ({
    id,
    nombre,
    unidad,
    seccion,
  }));
  const platos: PlatoMenu[] = PLATOS.map(([id, nombre, grupo, minutosActivos, ings]) => ({
    id,
    nombre,
    grupo,
    minutosActivos,
    ultimaVez: null,
    valoracion: null,
    porRevisar: true,
    ...(LIGEROS.has(id) ? { ligero: true } : {}),
    ingredientes: ings.map(([ingredienteId, cantidadPorRacion]) => ({
      ingredienteId,
      cantidadPorRacion,
      opcional: false,
    })),
  }));
  // Cenas de la semana de la planificación (martes a viernes) y el sábado del cumpleaños.
  const cenas = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
  const ocurrencias: Ocurrencia[] = cenas.map((fecha) => ({ cargaId: "cenas", fecha }));
  return {
    hoy,
    ingredientes,
    platos,
    excluirIngredientes: [],
    colegio: aMenuCole(leerMenuCole(TEXTO_MENU_COLE_NOVIEMBRE_2026).dias),
    llegoTarde: [],
    horizonte: "semana",
    valoraciones: {},
    eventos: { [FECHA_CUMPLE_ANA]: { titulo: "Cumpleaños de Ana", emoji: "🎂" } },
    // El lunes 2 no hay menú del cole y la planificación de ahora es de martes a viernes.
    saltados: ["2026-11-02"],
    tareas: TAREAS_FAMILIA.map(([personaId, frecuencia, texto], i) => ({
      id: `t-${i}`,
      personaId,
      texto,
      frecuencia,
      hechas: [],
    })),
    personas: PERSONAS_DIEGO,
    despensa: [],
    comidas: [],
    manuales: [],
    compras: [],
    operaciones: [],
    cargas,
    // El día del cumpleaños cocina Diego: Ana tiene el día libre de cocina.
    turnos: [
      { cargaId: "cenas", fecha: FECHA_CUMPLE_ANA, personaId: "diego", estado: "pendiente" },
    ],
    ocurrencias,
    siguienteId: 1,
    aviso: null,
  };
}
