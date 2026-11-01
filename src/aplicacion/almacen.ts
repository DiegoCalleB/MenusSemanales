import type { EstadoHogar } from "./estado";

/**
 * Puerto de persistencia del estado del hogar. La interfaz solo conoce esta forma: hoy la cumple el
 * almacén local del modo prueba (sin cuenta, solo en este dispositivo) y, cuando haya acceso con
 * cuenta, la cumplirá un adaptador de Supabase sin tocar las vistas ni el reductor (D-038, D-043).
 */
export interface AlmacenHogar {
  /** Estado guardado, o null si no hay nada (o no es válido). */
  cargar(): EstadoHogar | null;
  guardar(estado: EstadoHogar): void;
  borrar(): void;
}
