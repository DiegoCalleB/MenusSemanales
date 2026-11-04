import { timingSafeEqual } from "node:crypto";
import {
  avisosDeHoy,
  entradaDeProyeccion,
  notificacionDelDia,
  resumenDelDia,
} from "@/dominio/avisos";
import { hoyEnMadrid, leerResumenDelCalendario } from "@/infraestructura/calendario-suscrito";
import { enviarPush, pushConfigurado } from "@/infraestructura/avisos/push";
import { CorreoNoConfigurado, enviarCorreo } from "@/infraestructura/avisos/resend";
import { leerSuscripciones, olvidarSuscripcion } from "@/infraestructura/avisos/suscripciones";

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
  const quiereCorreo = para.includes("@");
  const quierePush = pushConfigurado();
  if (!/^[0-9a-f]{64}$/.test(token) || (!quiereCorreo && !quierePush)) {
    return responder({ error: "no-configurado" }, 503);
  }

  const forzar = new URL(request.url).searchParams.get("forzar") === "1";
  const horaElegida = Number(process.env.AVISOS_HORA ?? "10");
  if (!forzar && horaEnMadrid() !== horaElegida)
    return responder({ enviado: false, motivo: "no-es-la-hora" }, 200);

  let hoy: string;
  let avisos: ReturnType<typeof avisosDeHoy>;
  try {
    hoy = hoyEnMadrid();
    const resumen = await leerResumenDelCalendario(token);
    if (!resumen) return responder({ error: "sin-datos" }, 404);
    avisos = avisosDeHoy(entradaDeProyeccion(resumen, hoy));
  } catch (e) {
    console.error("[avisos] lectura", e instanceof Error ? e.message : "desconocido");
    return responder({ error: "no-disponible" }, 502);
  }

  // Cada canal va por su cuenta: que falle uno no impide el otro. Sin detalles hacia fuera.
  const resultado: {
    correo?: "ok" | "fallo" | "no-configurado";
    push?: { enviadas: number; caducadas: number; fallos: number };
  } = {};

  if (quiereCorreo) {
    try {
      const correo = resumenDelDia(hoy, avisos);
      await enviarCorreo({
        para,
        ...correo,
        clave: `resumen-${hoy}${forzar ? `-${Date.now()}` : ""}`,
      });
      resultado.correo = "ok";
    } catch (e) {
      console.error("[avisos] correo", e instanceof Error ? e.message : "desconocido");
      resultado.correo = e instanceof CorreoNoConfigurado ? "no-configurado" : "fallo";
    }
  }

  if (quierePush) {
    const cuenta = { enviadas: 0, caducadas: 0, fallos: 0 };
    try {
      const mensaje = notificacionDelDia(hoy, avisos);
      for (const s of await leerSuscripciones(token)) {
        const r = await enviarPush(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          mensaje,
        );
        if (r === "ok") cuenta.enviadas += 1;
        else if (r === "caducada") {
          cuenta.caducadas += 1;
          await olvidarSuscripcion(token, s.endpoint);
        } else cuenta.fallos += 1;
      }
    } catch (e) {
      console.error("[avisos] push", e instanceof Error ? e.message : "desconocido");
      cuenta.fallos += 1;
    }
    resultado.push = cuenta;
  }

  const algunoBien = resultado.correo === "ok" || (resultado.push?.enviadas ?? 0) > 0;
  const hayIntentos = resultado.correo !== undefined && resultado.correo !== "no-configurado";
  // Con push configurado y sin móviles suscritos no hay nada que enviar: no es un error.
  const pushSinMoviles =
    !!resultado.push &&
    resultado.push.enviadas + resultado.push.caducadas + resultado.push.fallos === 0;
  if (!algunoBien && !pushSinMoviles && (hayIntentos || resultado.push)) {
    return responder({ enviado: false, ...resultado }, 502);
  }
  if (!algunoBien && !hayIntentos && !resultado.push)
    return responder({ error: "no-configurado" }, 503);
  return responder({ enviado: algunoBien, avisos: avisos.length, ...resultado }, 200);
}
