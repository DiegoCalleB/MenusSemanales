import { timingSafeEqual } from "node:crypto";
import { avisosDeHoy, entradaDeProyeccion, resumenDelDia } from "@/dominio/avisos";
import { hoyEnMadrid, leerResumenDelCalendario } from "@/infraestructura/calendario-suscrito";
import { CorreoNoConfigurado, enviarCorreo } from "@/infraestructura/avisos/resend";

const CABECERAS = { "Cache-Control": "no-store", "Content-Type": "application/json" } as const;
const responder = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: CABECERAS });

const iguales = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const horaEnMadrid = (ahora = new Date()) =>
  Number(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "numeric",
      hourCycle: "h23",
    }).format(ahora),
  );

/**
 * El resumen de la mañana por correo (D-114). Lo llama un programa que se ejecuta solo cada día
 * (GitHub Actions), con un secreto en la cabecera: sin él, 401. Lee solo el resumen mínimo del
 * calendario (con su token), nunca claves maestras. Solo envía a la hora elegida (hora de Madrid,
 * por defecto las 10): así el programa puede llamar dos veces al día (horario de verano e
 * invierno) y solo una cuenta. `?forzar=1` salta la comprobación de la hora, para probar.
 */
export async function POST(request: Request) {
  const secreto = process.env.AVISOS_CRON_SECRET;
  if (!secreto || secreto.length < 24) return responder({ error: "no-configurado" }, 503);
  const dado = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!iguales(dado, secreto)) return responder({ error: "no-autorizado" }, 401);

  const token = process.env.AVISOS_CALENDARIO_TOKEN ?? "";
  const para = process.env.AVISOS_CORREO?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/.test(token) || !para.includes("@")) {
    return responder({ error: "no-configurado" }, 503);
  }

  const forzar = new URL(request.url).searchParams.get("forzar") === "1";
  const horaElegida = Number(process.env.AVISOS_HORA ?? "10");
  if (!forzar && horaEnMadrid() !== horaElegida)
    return responder({ enviado: false, motivo: "no-es-la-hora" }, 200);

  try {
    const hoy = hoyEnMadrid();
    const resumen = await leerResumenDelCalendario(token);
    if (!resumen) return responder({ error: "sin-datos" }, 404);
    const avisos = avisosDeHoy(entradaDeProyeccion(resumen, hoy));
    const correo = resumenDelDia(hoy, avisos);
    await enviarCorreo({
      para,
      ...correo,
      clave: `resumen-${hoy}${forzar ? `-${Date.now()}` : ""}`,
    });
    return responder({ enviado: true, avisos: avisos.length }, 200);
  } catch (e) {
    // Sin detalles: ni el contenido ni lo que responda el proveedor salen del servidor.
    console.error("[avisos] fallo", e instanceof Error ? e.message : "desconocido");
    return responder(
      { error: e instanceof CorreoNoConfigurado ? "no-configurado" : "no-disponible" },
      e instanceof CorreoNoConfigurado ? 503 : 502,
    );
  }
}
