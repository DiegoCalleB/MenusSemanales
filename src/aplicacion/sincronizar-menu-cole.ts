import type { FechaIso } from "@/dominio/fechas";
import { type MenuColeLeido, leerMenuCole } from "@/dominio/menu-cole";
import {
  type EntradaBlog,
  comprobarMenuLeido,
  diasParaGuardar,
  entradasDeMenu,
  nombreDelMes,
} from "@/dominio/menu-cole-blog";

/**
 * La sincronización diaria del menú del cole (D-173). Por cada colegio con blog: mira las entradas
 * de menú de las últimas semanas, y la primera que aún no se ha cargado la baja, la lee con IA, la
 * comprueba y la carga (sin pisar lo ya apuntado). Cada paso externo se pasa en `Dependencias` para
 * poder probarlo sin red.
 */

export interface CentroConBlog {
  centro: string;
  fuente: string;
  /** Enlaces del calendario de los hogares del colegio, para avisarles. */
  tokens: string[];
}
export interface Visto {
  post: string;
  resultado: string;
  intentos: number;
  vistoEn: string;
}
export interface Dependencias {
  hoy: FechaIso;
  ahora: () => number;
  centros: () => Promise<CentroConBlog[]>;
  entradas: (fuente: string) => Promise<EntradaBlog[]>;
  vistas: (centro: string) => Promise<Visto[]>;
  /** El PDF del menú (en base64) de la carpeta de la nube, o null si no se puede bajar. */
  pdf: (carpeta: string) => Promise<string | null>;
  transcribir: (pdfBase64: string) => Promise<string>;
  registrar: (
    centro: string,
    post: string,
    resultado: string,
    dias?: ReturnType<typeof diasParaGuardar>,
  ) => Promise<string | null>;
  /** Avisa a los móviles de un hogar. */
  avisar: (token: string, titulo: string, cuerpo: string) => Promise<void>;
}

/** Solo se miran las entradas de las últimas semanas (las viejas ya no hacen falta). */
const DIAS_VENTANA = 21;
const MAX_INTENTOS = 3;
const REINTENTO_MS = 20 * 3600 * 1000;

export type Resultado = Array<{ centro: string; post: string; resultado: string }>;

export async function sincronizarMenuCole(d: Dependencias): Promise<Resultado> {
  const salida: Resultado = [];
  for (const c of await d.centros()) {
    const [entradas, vistas] = await Promise.all([d.entradas(c.fuente), d.vistas(c.centro)]);
    const desde = new Date(`${d.hoy}T12:00:00Z`);
    desde.setUTCDate(desde.getUTCDate() - DIAS_VENTANA);
    const pendiente = entradasDeMenu(entradas, d.hoy)
      .filter((e) => e.publicada >= desde.toISOString().slice(0, 10))
      .find((e) => {
        const v = vistas.find((x) => x.post === e.enlace);
        if (!v) return true;
        if (v.resultado.startsWith("cargado")) return false;
        // Un fallo se reintenta una vez al día, hasta tres veces.
        return v.intentos < MAX_INTENTOS && d.ahora() - Date.parse(v.vistoEn) > REINTENTO_MS;
      });
    if (!pendiente?.carpeta) continue;

    let resultado: string;
    let leido: MenuColeLeido | null = null;
    try {
      const pdf = await d.pdf(pendiente.carpeta);
      if (!pdf) {
        resultado = "sin-pdf";
      } else {
        const texto = await d.transcribir(pdf);
        leido = leerMenuCole(texto);
        const v = comprobarMenuLeido(leido, d.hoy);
        resultado = v.ok ? "ok" : `no-valido: ${v.motivo}`;
      }
    } catch (e) {
      resultado = `error: ${e instanceof Error ? e.message.slice(0, 60) : "desconocido"}`;
    }

    const guardado =
      resultado === "ok" && leido
        ? await d.registrar(c.centro, pendiente.enlace, resultado, diasParaGuardar(leido))
        : await d.registrar(c.centro, pendiente.enlace, resultado);
    salida.push({ centro: c.centro, post: pendiente.enlace, resultado: guardado ?? resultado });

    const nuevos = Number(/^cargado:(\d+)$/.exec(guardado ?? "")?.[1] ?? 0);
    if (nuevos > 0 && leido) {
      for (const t of c.tokens) {
        await d
          .avisar(
            t,
            `🍽️ Ya está el menú de ${nombreDelMes(leido.mes)}`,
            `He cargado ${nuevos} días del cole en la app.`,
          )
          .catch(() => undefined);
      }
    }
  }
  return salida;
}
