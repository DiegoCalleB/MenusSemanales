/**
 * Encontrar los PDF del calendario escolar de un curso en la página de la Comunidad de Madrid
 * (D-146): la orden del BOCM y el cuadro resumen. Puro: recibe el HTML y devuelve direcciones.
 */

export const PAGINA_CALENDARIO_ESCOLAR =
  "https://www.comunidad.madrid/educacion/calendario-escolar";
const ORIGEN = "https://www.comunidad.madrid";

export interface EnlacesDelCurso {
  /** La orden publicada en el BOCM (manda). */
  orden: string | null;
  /** El cuadro resumen (se actualiza cuando salen los festivos del año siguiente). */
  cuadro: string | null;
}

/** Solo PDF de la propia Comunidad (o del BOCM): nunca se descarga nada de otro sitio. */
function absoluta(href: string): string | null {
  const limpio = href.replace(/&amp;/g, "&");
  try {
    const u = new URL(limpio, ORIGEN);
    const permitido =
      u.protocol === "https:" &&
      (u.hostname === "www.comunidad.madrid" || u.hostname === "www.bocm.es");
    return permitido && /\.pdf$/i.test(u.pathname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Los PDF del curso que empieza en `anio` (p. ej. 2027 → «2027-28», «27-28»). */
export function enlacesDelCurso(html: string, anio: number): EnlacesDelCurso {
  const corto = `${String(anio % 100).padStart(2, "0")}-${String((anio + 1) % 100).padStart(2, "0")}`;
  const largo = `${anio}-${String((anio + 1) % 100).padStart(2, "0")}`;
  const largo4 = `${anio}-${anio + 1}`;
  let orden: string | null = null;
  let cuadro: string | null = null;
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const url = absoluta(m[1] ?? "");
    if (!url) continue;
    const nombre = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "").toLowerCase();
    if (!nombre.includes("calendario")) continue;
    const delCurso = nombre.includes(largo) || nombre.includes(largo4) || nombre.includes(corto);
    if (!delCurso) continue;
    if (nombre.includes("orden") || nombre.includes("bocm")) orden ??= url;
    else cuadro ??= url;
  }
  return { orden, cuadro };
}
