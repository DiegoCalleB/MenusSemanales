import type {
  Carga,
  ComidaPlanificada,
  Ingrediente,
  ItemDespensa,
  Persona,
  Turno,
} from "@/dominio/tipos";
import { racionesDe } from "@/dominio/tipos";
import type { PlatoMenu } from "@/dominio/menu";
import { aMenuCole, leerMenuCole } from "@/dominio/menu-cole";
import { TEXTO_MENU_COLE_NOVIEMBRE_2026 } from "@/dominio/menu-cole-ejemplo";
import type { Ocurrencia } from "@/dominio/reparto";
import type { EstadoHogar } from "./estado";

/**
 * Datos de demostración de una familia de cuatro (dos adultos y dos niñas). Sirven para que las
 * pantallas funcionen sin cuenta; no se guardan en ningún sitio. «Hoy» es fijo (miércoles) para que
 * la demo y los tests sean deterministas.
 */

const HOY = "2026-11-04";

const ingredientes: Ingrediente[] = [
  { id: "pasta", nombre: "Pasta", unidad: "g", seccion: "despensa" },
  { id: "arroz", nombre: "Arroz", unidad: "g", seccion: "despensa" },
  { id: "tomate", nombre: "Tomate", unidad: "g", seccion: "fruta_verdura" },
  { id: "calabacin", nombre: "Calabacín", unidad: "g", seccion: "fruta_verdura" },
  { id: "patata", nombre: "Patata", unidad: "g", seccion: "fruta_verdura" },
  { id: "huevo", nombre: "Huevos", unidad: "ud", seccion: "huevos" },
  { id: "leche", nombre: "Leche", unidad: "ml", seccion: "lacteos" },
  { id: "queso", nombre: "Queso rallado", unidad: "g", seccion: "lacteos" },
  { id: "yogur", nombre: "Yogur natural", unidad: "ud", seccion: "lacteos" },
  { id: "pollo", nombre: "Pechuga de pollo", unidad: "g", seccion: "carne" },
  { id: "merluza", nombre: "Merluza", unidad: "g", seccion: "congelados" },
  { id: "pan", nombre: "Pan", unidad: "ud", seccion: "panaderia" },
  { id: "lentejas", nombre: "Lentejas", unidad: "g", seccion: "despensa" },
  { id: "garbanzos", nombre: "Garbanzos cocidos", unidad: "g", seccion: "conservas" },
  { id: "zanahoria", nombre: "Zanahoria", unidad: "g", seccion: "fruta_verdura" },
  { id: "cebolla", nombre: "Cebolla", unidad: "g", seccion: "fruta_verdura" },
  { id: "espinacas", nombre: "Espinacas", unidad: "g", seccion: "fruta_verdura" },
  { id: "atun", nombre: "Atún en lata", unidad: "ud", seccion: "conservas" },
  { id: "salmon", nombre: "Salmón", unidad: "g", seccion: "pescado" },
  { id: "ternera", nombre: "Ternera picada", unidad: "g", seccion: "carne" },
];

const platos: PlatoMenu[] = [
  {
    id: "pasta-tomate",
    grupo: "pasta",
    minutosActivos: 20,
    ultimaVez: "2026-10-26",
    valoracion: 4,
    nombre: "Pasta con tomate",
    ingredientes: [
      { ingredienteId: "pasta", cantidadPorRacion: 80, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "queso", cantidadPorRacion: 10, opcional: true },
    ],
  },
  {
    id: "arroz-pollo",
    grupo: "arroz",
    minutosActivos: 25,
    ultimaVez: "2026-10-14",
    valoracion: 5,
    nombre: "Arroz con pollo al curry",
    ingredientes: [
      { ingredienteId: "arroz", cantidadPorRacion: 70, opcional: false },
      { ingredienteId: "pollo", cantidadPorRacion: 100, opcional: false },
    ],
  },
  {
    id: "crema-calabacin",
    grupo: "verdura",
    minutosActivos: 25,
    ultimaVez: "2026-10-05",
    valoracion: 3,
    nombre: "Crema de calabacín",
    ingredientes: [
      { ingredienteId: "calabacin", cantidadPorRacion: 200, opcional: false },
      { ingredienteId: "patata", cantidadPorRacion: 50, opcional: false },
      { ingredienteId: "queso", cantidadPorRacion: 10, opcional: true },
    ],
  },
  {
    id: "tortilla",
    grupo: "huevo",
    minutosActivos: 10,
    ultimaVez: "2026-10-30",
    valoracion: 4,
    nombre: "Tortilla francesa",
    ingredientes: [{ ingredienteId: "huevo", cantidadPorRacion: 2, opcional: false }],
  },
  {
    id: "merluza-patata",
    grupo: "pescado",
    minutosActivos: 15,
    ultimaVez: "2026-10-18",
    valoracion: 4,
    nombre: "Merluza al horno con patata",
    ingredientes: [
      { ingredienteId: "merluza", cantidadPorRacion: 150, opcional: false },
      { ingredienteId: "patata", cantidadPorRacion: 150, opcional: false },
    ],
  },
  {
    id: "lentejas-verduras",
    nombre: "Lentejas con verduras",
    grupo: "legumbre",
    minutosActivos: 25,
    ultimaVez: "2026-10-12",
    valoracion: 4,
    ingredientes: [
      { ingredienteId: "lentejas", cantidadPorRacion: 70, opcional: false },
      { ingredienteId: "zanahoria", cantidadPorRacion: 50, opcional: false },
      { ingredienteId: "cebolla", cantidadPorRacion: 30, opcional: false },
    ],
  },
  {
    id: "garbanzos-espinacas",
    nombre: "Garbanzos con espinacas",
    grupo: "legumbre",
    minutosActivos: 20,
    ultimaVez: null,
    valoracion: null,
    ingredientes: [
      { ingredienteId: "garbanzos", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "espinacas", cantidadPorRacion: 80, opcional: false },
    ],
  },
  {
    id: "macarrones-atun",
    nombre: "Macarrones con atún y tomate",
    grupo: "pasta",
    minutosActivos: 20,
    ultimaVez: "2026-10-21",
    valoracion: 4,
    ingredientes: [
      { ingredienteId: "pasta", cantidadPorRacion: 80, opcional: false },
      { ingredienteId: "atun", cantidadPorRacion: 0.5, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 80, opcional: false },
    ],
  },
  {
    id: "salmon-plancha",
    nombre: "Salmón a la plancha con patata",
    grupo: "pescado",
    minutosActivos: 15,
    ultimaVez: "2026-10-20",
    valoracion: 5,
    ingredientes: [
      { ingredienteId: "salmon", cantidadPorRacion: 120, opcional: false },
      { ingredienteId: "patata", cantidadPorRacion: 100, opcional: false },
    ],
  },
  {
    id: "hamburguesas",
    nombre: "Hamburguesas de ternera",
    grupo: "carne",
    minutosActivos: 20,
    ultimaVez: "2026-10-28",
    valoracion: 4,
    ingredientes: [
      { ingredienteId: "ternera", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "pan", cantidadPorRacion: 0.5, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 50, opcional: false },
    ],
  },
  {
    id: "pollo-ensalada",
    nombre: "Pollo a la plancha con ensalada",
    grupo: "carne",
    minutosActivos: 15,
    ultimaVez: "2026-10-24",
    valoracion: 3,
    ingredientes: [
      { ingredienteId: "pollo", cantidadPorRacion: 120, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 100, opcional: false },
    ],
  },
  {
    id: "huevos-patatas",
    nombre: "Huevos con patatas",
    grupo: "huevo",
    minutosActivos: 15,
    ultimaVez: "2026-10-09",
    valoracion: 5,
    ingredientes: [
      { ingredienteId: "huevo", cantidadPorRacion: 2, opcional: false },
      { ingredienteId: "patata", cantidadPorRacion: 150, opcional: false },
    ],
  },
  {
    id: "arroz-tres-delicias",
    nombre: "Arroz tres delicias",
    grupo: "arroz",
    minutosActivos: 20,
    ultimaVez: null,
    valoracion: null,
    ingredientes: [
      { ingredienteId: "arroz", cantidadPorRacion: 70, opcional: false },
      { ingredienteId: "huevo", cantidadPorRacion: 1, opcional: false },
      { ingredienteId: "zanahoria", cantidadPorRacion: 40, opcional: false },
    ],
  },
  {
    id: "pisto-huevo",
    nombre: "Pisto con huevo",
    grupo: "verdura",
    minutosActivos: 25,
    ultimaVez: "2026-10-02",
    valoracion: 4,
    ingredientes: [
      { ingredienteId: "calabacin", cantidadPorRacion: 150, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "huevo", cantidadPorRacion: 1, opcional: false },
    ],
  },
  {
    id: "tortilla-patata",
    nombre: "Tortilla de patata",
    grupo: "huevo",
    minutosActivos: 25,
    ultimaVez: "2026-09-30",
    valoracion: 5,
    ingredientes: [
      { ingredienteId: "huevo", cantidadPorRacion: 2, opcional: false },
      { ingredienteId: "patata", cantidadPorRacion: 150, opcional: false },
      { ingredienteId: "cebolla", cantidadPorRacion: 30, opcional: false },
    ],
  },
  {
    id: "bolonesa",
    nombre: "Pasta a la boloñesa",
    grupo: "pasta",
    minutosActivos: 25,
    ultimaVez: "2026-10-15",
    valoracion: 5,
    ingredientes: [
      { ingredienteId: "pasta", cantidadPorRacion: 80, opcional: false },
      { ingredienteId: "ternera", cantidadPorRacion: 80, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 80, opcional: false },
    ],
  },
  {
    id: "merluza-verduras",
    nombre: "Merluza a la plancha con verduras",
    grupo: "pescado",
    minutosActivos: 15,
    ultimaVez: "2026-10-10",
    valoracion: 4,
    ingredientes: [
      { ingredienteId: "merluza", cantidadPorRacion: 150, opcional: false },
      { ingredienteId: "calabacin", cantidadPorRacion: 100, opcional: false },
    ],
  },
  {
    id: "pollo-empanado",
    nombre: "Pollo empanado",
    grupo: "carne",
    minutosActivos: 25,
    ultimaVez: "2026-10-03",
    valoracion: 4,
    ingredientes: [
      { ingredienteId: "pollo", cantidadPorRacion: 120, opcional: false },
      { ingredienteId: "huevo", cantidadPorRacion: 0.5, opcional: false },
      { ingredienteId: "pan", cantidadPorRacion: 0.5, opcional: false },
    ],
  },
  {
    id: "arroz-atun",
    nombre: "Arroz con atún y tomate",
    grupo: "arroz",
    minutosActivos: 15,
    ultimaVez: null,
    valoracion: null,
    ingredientes: [
      { ingredienteId: "arroz", cantidadPorRacion: 70, opcional: false },
      { ingredienteId: "atun", cantidadPorRacion: 1, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 80, opcional: false },
    ],
  },
  {
    id: "revuelto-espinacas",
    nombre: "Revuelto de espinacas",
    grupo: "huevo",
    minutosActivos: 10,
    ultimaVez: "2026-10-06",
    valoracion: 3,
    ingredientes: [
      { ingredienteId: "huevo", cantidadPorRacion: 2, opcional: false },
      { ingredienteId: "espinacas", cantidadPorRacion: 80, opcional: false },
    ],
  },
  {
    id: "crema-zanahoria",
    nombre: "Crema de zanahoria",
    grupo: "verdura",
    minutosActivos: 20,
    ultimaVez: "2026-10-08",
    valoracion: 4,
    ingredientes: [
      { ingredienteId: "zanahoria", cantidadPorRacion: 200, opcional: false },
      { ingredienteId: "patata", cantidadPorRacion: 50, opcional: false },
      { ingredienteId: "cebolla", cantidadPorRacion: 30, opcional: false },
    ],
  },
];

const personas: Persona[] = [
  { id: "diego", nombre: "Diego", tipo: "adulto", activa: true, factorRacion: 1 },
  { id: "ana", nombre: "Ana", tipo: "adulto", activa: true, factorRacion: 1 },
  { id: "lucia", nombre: "Lucía", tipo: "nino", activa: true, factorRacion: 0.5 },
  { id: "carla", nombre: "Carla", tipo: "nino", activa: true, factorRacion: 0.5 },
];

const item = (
  ingredienteId: string,
  ubicacion: ItemDespensa["ubicacion"],
  cantidad: number,
  extra: Partial<ItemDespensa> = {},
): ItemDespensa => ({ ingredienteId, ubicacion, cantidad, minimo: null, caducaEn: null, ...extra });

const despensa: ItemDespensa[] = [
  item("pasta", "despensa", 400, { minimo: 200 }),
  item("arroz", "despensa", 150),
  item("patata", "despensa", 1500),
  item("pan", "despensa", 1),
  item("tomate", "nevera", 250, { caducaEn: "2026-11-06" }),
  item("huevo", "nevera", 4, { minimo: 6, caducaEn: "2026-11-14" }),
  item("leche", "nevera", 700, { minimo: 1000, caducaEn: "2026-11-05" }),
  item("pollo", "nevera", 300, { caducaEn: "2026-11-05" }),
  item("queso", "nevera", 120),
  item("yogur", "nevera", 3, { caducaEn: "2026-11-01" }), // ya caducado
  item("merluza", "congelador", 450),
];

const mesa = racionesDe(personas); // 1 + 1 + 0,5 + 0,5 = 3 raciones de adulto
const cena = (etiqueta: string, fecha: string, platoId: string): ComidaPlanificada => {
  const plato = platos.find((p) => p.id === platoId);
  if (!plato) throw new Error(`Plato desconocido: ${platoId}`);
  return { etiqueta, fecha, plato, raciones: mesa };
};

const comidas: ComidaPlanificada[] = [
  cena("Cena del miércoles", "2026-11-04", "arroz-pollo"),
  cena("Cena del jueves", "2026-11-05", "crema-calabacin"),
  cena("Cena del viernes", "2026-11-06", "tortilla"),
  cena("Cena del domingo", "2026-11-08", "merluza-patata"),
];

const cargas: Carga[] = [
  {
    id: "cenas",
    nombre: "Cenas entre semana",
    tipo: "cena",
    esfuerzoMin: 40,
    planificacionMin: 30,
    responsableId: "ana",
    activa: true,
  },
  {
    id: "compra",
    nombre: "Compra semanal",
    tipo: "compra",
    esfuerzoMin: 60,
    planificacionMin: 45,
    responsableId: "ana",
    activa: true,
  },
  {
    id: "cole",
    nombre: "Gestiones del cole",
    tipo: "cole",
    esfuerzoMin: 15,
    planificacionMin: 25,
    responsableId: "ana",
    activa: true,
  },
  {
    id: "basura",
    nombre: "Sacar la basura",
    tipo: "tarea",
    esfuerzoMin: 5,
    planificacionMin: 0,
    responsableId: "diego",
    activa: true,
  },
  {
    id: "lavadora",
    nombre: "Lavadoras",
    tipo: "tarea",
    esfuerzoMin: 20,
    planificacionMin: 10,
    responsableId: "diego",
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

const ocurrencias: Ocurrencia[] = [
  ...["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map((fecha) => ({
    cargaId: "cenas",
    fecha,
  })),
  { cargaId: "compra", fecha: "2026-11-07" },
  ...["2026-11-02", "2026-11-04", "2026-11-06"].map((fecha) => ({ cargaId: "basura", fecha })),
  ...["2026-11-03", "2026-11-07"].map((fecha) => ({ cargaId: "lavadora", fecha })),
  { cargaId: "cole", fecha: "2026-11-05" },
  { cargaId: "sabanas", fecha: "2026-11-08" },
];

// Reparto inicial: Ana cocina casi todo y además se encarga de acordarse y organizar.
const turnos: Turno[] = [
  { cargaId: "cenas", fecha: "2026-11-02", personaId: "ana", estado: "hecho" },
  { cargaId: "cenas", fecha: "2026-11-03", personaId: "ana", estado: "hecho" },
  { cargaId: "cenas", fecha: "2026-11-04", personaId: "ana", estado: "pendiente" },
  { cargaId: "cenas", fecha: "2026-11-05", personaId: "diego", estado: "pendiente" },
  { cargaId: "compra", fecha: "2026-11-07", personaId: "ana", estado: "pendiente" },
  { cargaId: "basura", fecha: "2026-11-02", personaId: "diego", estado: "hecho" },
  { cargaId: "basura", fecha: "2026-11-04", personaId: "diego", estado: "pendiente" },
  { cargaId: "basura", fecha: "2026-11-06", personaId: "diego", estado: "pendiente" },
  { cargaId: "lavadora", fecha: "2026-11-03", personaId: "diego", estado: "hecho" },
  { cargaId: "lavadora", fecha: "2026-11-07", personaId: "diego", estado: "pendiente" },
  { cargaId: "cole", fecha: "2026-11-05", personaId: "ana", estado: "pendiente" },
];

export function estadoInicialDemo(): EstadoHogar {
  return {
    hoy: HOY,
    ingredientes,
    platos,
    excluirIngredientes: [],
    // Menú real del cole (Basal, noviembre 2026): se lee del texto del PDF con el mismo lector que la app.
    colegio: aMenuCole(leerMenuCole(TEXTO_MENU_COLE_NOVIEMBRE_2026).dias),
    horizonte: "semana",
    valoraciones: {},
    llegoTarde: [],
    personas,
    despensa,
    comidas,
    manuales: [{ id: "m-0", nombre: "Papel de cocina", comprado: false }],
    compras: [],
    operaciones: [],
    cargas,
    turnos,
    ocurrencias,
    siguienteId: 1,
    aviso: null,
  };
}
