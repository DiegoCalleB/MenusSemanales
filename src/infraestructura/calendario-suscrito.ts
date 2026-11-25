import { type ProyeccionCalendario, proyeccionSchema } from "@/dominio/calendario-suscrito";
import { sumarDias } from "@/dominio/fechas";
import { eventosDeRepetidas } from "@/dominio/repetidas";

const TOKEN = /^[0-9a-f]{64}$/;

/** Hoy en Madrid (AAAA-MM-DD): el servidor puede estar en otra zona horaria. */
export const hoyEnMadrid = (ahora = new Date()): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(ahora);

/**
 * Pide a Supabase el resumen del calendario de un hogar con su token (D-083). Usa solo la clave
 * pública: la función de la base de datos devuelve lo mínimo y nada más. null si el token no vale,
 * no hay plan guardado o la respuesta no tiene la forma esperada; lanza si Supabase no responde.
 */
export async function leerResumenDelCalendario(
  token: string,
): Promise<ProyeccionCalendario | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave || !TOKEN.test(token)) return null;
  const r = await fetch(`${url}/rest/v1/rpc/estado_para_calendario`, {
    method: "POST",
    headers: { apikey: clave, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error("supabase-no-responde");
  const cuerpo: unknown = await r.json();
  if (cuerpo === null) return null;
  const valido = proyeccionSchema.safeParse(cuerpo);
  if (!valido.success) return null;
  return conRepetidas(valido.data);
}

/**
 * Las fechas que se repiten (D-211) pasan a ser citas de los próximos días en lo que lee el servidor:
 * así los avisos del móvil, el resumen del día y el calendario suscrito las tratan como cualquier
 * cita (incluido el recordatorio del día antes). No se guardan copias: se calculan cada vez.
 */
export function conRepetidas(
  p: ProyeccionCalendario,
  hoy: string = hoyEnMadrid(),
): ProyeccionCalendario {
  const series = p.repetidas ?? [];
  if (series.length === 0) return p;
  const extra = eventosDeRepetidas(
    series.map((s, i) => ({ id: `s${i}`, creadoEn: hoy, ...s })),
    sumarDias(hoy, -1),
    // Solo la próxima semana: lo que miran los avisos; y el calendario suscrito no se llena (D-212).
    sumarDias(hoy, 8),
  ).map((e) => ({ fecha: e.fecha, hasta: null, hora: e.hora, titulo: e.titulo }));
  return { ...p, agenda: [...p.agenda, ...extra] };
}

/** Límite sencillo por dirección (por instancia): frena a quien pida el calendario sin parar. */
const peticiones = new Map<string, { desde: number; n: number }>();
export function demasiadasPeticiones(clave: string, ahora = Date.now(), maximo = 60): boolean {
  const e = peticiones.get(clave);
  if (!e || ahora - e.desde > 60_000) {
    if (peticiones.size > 5000) peticiones.clear();
    peticiones.set(clave, { desde: ahora, n: 1 });
    return false;
  }
  e.n += 1;
  return e.n > maximo;
}
