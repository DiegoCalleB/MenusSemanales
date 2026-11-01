import type {
  Carga,
  ComidaPlanificada,
  Ingrediente,
  ItemDespensa,
  Persona,
  Plato,
  Turno,
} from "@/dominio/tipos";
import { racionesDe } from "@/dominio/tipos";
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
];

const platos: Plato[] = [
  {
    id: "pasta-tomate",
    nombre: "Pasta con tomate",
    ingredientes: [
      { ingredienteId: "pasta", cantidadPorRacion: 80, opcional: false },
      { ingredienteId: "tomate", cantidadPorRacion: 100, opcional: false },
      { ingredienteId: "queso", cantidadPorRacion: 10, opcional: true },
    ],
  },
  {
    id: "arroz-pollo",
    nombre: "Arroz con pollo al curry",
    ingredientes: [
      { ingredienteId: "arroz", cantidadPorRacion: 70, opcional: false },
      { ingredienteId: "pollo", cantidadPorRacion: 100, opcional: false },
    ],
  },
  {
    id: "crema-calabacin",
    nombre: "Crema de calabacín",
    ingredientes: [
      { ingredienteId: "calabacin", cantidadPorRacion: 200, opcional: false },
      { ingredienteId: "patata", cantidadPorRacion: 50, opcional: false },
      { ingredienteId: "queso", cantidadPorRacion: 10, opcional: true },
    ],
  },
  {
    id: "tortilla",
    nombre: "Tortilla francesa",
    ingredientes: [{ ingredienteId: "huevo", cantidadPorRacion: 2, opcional: false }],
  },
  {
    id: "merluza-patata",
    nombre: "Merluza al horno con patata",
    ingredientes: [
      { ingredienteId: "merluza", cantidadPorRacion: 150, opcional: false },
      { ingredienteId: "patata", cantidadPorRacion: 150, opcional: false },
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
