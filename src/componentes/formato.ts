import { diasEntre, type FechaIso } from "@/dominio/fechas";
import type { Ubicacion, Unidad } from "@/dominio/tipos";

const numero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

/** 1500 g → «1,5 kg»; 250 ml → «250 ml»; 3 ud → «3 ud». */
export function formatearCantidad(cantidad: number, unidad: Unidad): string {
  if (unidad === "g" && cantidad >= 1000) return `${numero.format(cantidad / 1000)} kg`;
  if (unidad === "ml" && cantidad >= 1000) return `${numero.format(cantidad / 1000)} l`;
  return `${numero.format(cantidad)} ${unidad}`;
}

export const formatearNumero = (n: number): string => numero.format(n);

export type EstadoCaducidad =
  | { tipo: "caducado"; dias: number }
  | { tipo: "pronto"; dias: number; texto: string }
  | { tipo: "bien" };

/** Cuánto falta para que caduque; avisa a partir de 3 días. */
export function estadoDeCaducidad(hoy: FechaIso, caducaEn: FechaIso | null): EstadoCaducidad {
  if (caducaEn === null) return { tipo: "bien" };
  const dias = diasEntre(hoy, caducaEn);
  if (dias < 0) return { tipo: "caducado", dias: -dias };
  if (dias > 3) return { tipo: "bien" };
  const texto = dias === 0 ? "Caduca hoy" : dias === 1 ? "Caduca mañana" : `Caduca en ${dias} días`;
  return { tipo: "pronto", dias, texto };
}

export const NOMBRE_SECCION: Record<string, string> = {
  fruta_verdura: "Fruta y verdura",
  panaderia: "Panadería",
  carne: "Carne",
  pescado: "Pescado",
  lacteos: "Lácteos",
  huevos: "Huevos",
  conservas: "Conservas",
  despensa: "Despensa",
  congelados: "Congelados",
  bebidas: "Bebidas",
  limpieza: "Limpieza y hogar",
  otros: "Otros",
};

export const NOMBRE_UBICACION: Record<Ubicacion, string> = {
  nevera: "Nevera",
  despensa: "Despensa",
  congelador: "Congelador",
};

/** Paso de los botones − y +: 50 g o ml, o 1 unidad. */
export const pasoDe = (unidad: Unidad): number => (unidad === "ud" ? 1 : 50);
