import { timingSafeEqual } from "node:crypto";
import {
  type Aviso,
  avisosAntesDelCole,
  avisosDeHoy,
  avisosDeLaNoche,
  direccionesDeAvisos,
  entradaDeProyeccion,
  notificacionAntesDelCole,
  notificacionDeLaNoche,
  notificacionDelDia,
  resumenDelDia,
} from "@/dominio/avisos";
import { hoyEnMadrid, leerResumenDelCalendario } from "@/infraestructura/calendario-suscrito";
import { enviarPush, generarClavesVapid, pushConfigurado } from "@/infraestructura/avisos/push";
import {
  type ClavesVapid,
  comprobarSecretoDeAvisos,
  guardarClavesDeAvisos,
} from "@/infraestructura/avisos/claves";
import { CorreoNoConfigurado, enviarCorreo } from "@/infraestructura/avisos/resend";
import { leerSuscripciones, olvidarSuscripcion } from "@/infraestructura/avisos/suscripciones";
import { leerPrevision } from "@/infraestructura/tiempo";
import { cargarCursosEscolares } from "@/infraestructura/calendario-escolar";

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

const TOKEN = /^[0-9a-f]{64}$/;

/**
 * Lo que manda la llamada programada en el cuerpo: el token del calendario del hogar y, para
 * «Enviarme una prueba», el móvil al que mandarla (`{ "token": "…", "prueba": "https://…" }`).
 */
async function leerCuerpo(
  request: Request,
): Promise<{ token: string | null; prueba: string | null }> {
  try {
    const c = (await request.json()) as { token?: unknown; prueba?: unknown };
    return {
      token: typeof c?.token === "string" && TOKEN.test(c.token) ? c.token : null,
      prueba:
        typeof c?.prueba === "string" && c.prueba.startsWith("https://") && c.prueba.length <= 1000
          ? c.prueba
          : null,
    };
  } catch {
    return { token: null, prueba: null };
  }
}

/**
 * Los avisos del día (D-114, D-115, D-139). Lo llama, con un secreto en la cabecera, la propia
 * base de datos cada hora (pg_cron) o, con la configuración antigua, un programa con el secreto de
 * las variables de Railway. Sin secreto válido, 401. A la hora de la mañana (`AVISOS_HORA`, por
 * defecto las 9 de Madrid) manda el resumen del día; a la de la noche (`AVISOS_HORA_NOCHE`, por
 * defecto las 20) solo si hay algo que dejar preparado o una cita mañana. A otras horas no hace
 * nada. `?forzar=1` manda el de la mañana aunque no sea la hora, para probar.
 *
 * Antes de salir de casa (`AVISOS_HORA_TEMPRANO`, por defecto las 7), un día de cole, vuelve a
 * leer la previsión y, si va a llover en la ida o en la vuelta, avisa de coger el paraguas (D-148).
 *
 * Con el secreto de la base de datos, la primera llamada crea las claves de las notificaciones y
 * las guarda allí: no hay que configurar nada a mano.
 */
export async function POST(request: Request) {
  const dado = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const secretoVariables = process.env.AVISOS_CRON_SECRET ?? "";
  const conVariables = secretoVariables.length >= 24;

  // Las claves de las notificaciones: las de la base de datos o, si no, las de las variables.
  let claves: ClavesVapid | null = null;
  let porBaseDeDatos = false;
  if (conVariables && iguales(dado, secretoVariables)) {
    // Configuración antigua: todo por variables.
  } else if (TOKEN.test(dado)) {
    let r;
    try {
      r = await comprobarSecretoDeAvisos(dado);
    } catch {
      return responder({ error: "no-disponible" }, 502);
    }
    if (!r.valido) return responder({ error: "no-autorizado" }, 401);
    porBaseDeDatos = true;
    claves = r.claves;
    if (!claves && !pushConfigurado()) {
      // Primera llamada: se crean las claves y se guardan (si otra llamada se adelantó, valen las suyas).
      const { publicKey, privateKey } = generarClavesVapid();
      try {
        claves = await guardarClavesDeAvisos(dado, { publica: publicKey, privada: privateKey });
      } catch {
        return responder({ error: "no-disponible" }, 502);
      }
      return responder({ claves: claves ? "creadas" : "fallo" }, claves ? 200 : 502);
    }
  } else {
    return conVariables
      ? responder({ error: "no-autorizado" }, 401)
      : responder({ error: "no-configurado" }, 503);
  }

  const cuerpo = porBaseDeDatos ? await leerCuerpo(request) : { token: null, prueba: null };
  const token = cuerpo.token ?? process.env.AVISOS_CALENDARIO_TOKEN ?? "";

  // «Enviarme una prueba»: solo a ese móvil, y solo si es una suscripción de ese hogar.
  if (cuerpo.prueba && cuerpo.token) {
    try {
      const s = (await leerSuscripciones(cuerpo.token)).find((x) => x.endpoint === cuerpo.prueba);
      if (!s) return responder({ error: "no-encontrada" }, 404);
      const r = await enviarPush(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        { titulo: "Notificaciones activadas 🎉", cuerpo: "Así te llegarán los avisos de ¡Hecho!." },
        undefined,
        claves,
      );
      if (r === "caducada") await olvidarSuscripcion(cuerpo.token, s.endpoint);
      return responder({ prueba: r }, r === "ok" ? 200 : 502);
    } catch {
      return responder({ error: "no-disponible" }, 502);
    }
  }
  // El correo es de la configuración antigua (con su token); la llamada de la base de datos, push.
  const para = porBaseDeDatos ? [] : direccionesDeAvisos(process.env.AVISOS_CORREO);
  const quiereCorreo = para.length > 0;
  const quierePush = claves !== null || pushConfigurado();
  if (!TOKEN.test(token) || (!quiereCorreo && !quierePush)) {
    return responder({ error: "no-configurado" }, 503);
  }

  const forzar = new URL(request.url).searchParams.get("forzar") === "1";
  const hora = horaEnMadrid();
  const horaManana = Number(process.env.AVISOS_HORA ?? "9");
  const horaNoche = Number(process.env.AVISOS_HORA_NOCHE ?? "20");
  const horaTemprano = Number(process.env.AVISOS_HORA_TEMPRANO ?? "7");
  const momento =
    forzar || hora === horaManana
      ? "manana"
      : hora === horaNoche
        ? "noche"
        : hora === horaTemprano
          ? "temprano"
          : null;
  if (!momento) return responder({ enviado: false, motivo: "no-es-la-hora" }, 200);

  let hoy: string;
  let avisos: Aviso[];
  try {
    hoy = hoyEnMadrid();
    const [resumen, tiempo, escolar] = await Promise.all([
      leerResumenDelCalendario(token),
      leerPrevision(fetch, { fresco: momento === "temprano" }),
      cargarCursosEscolares(),
    ]);
    if (!resumen) return responder({ error: "sin-datos" }, 404);
    const entrada = {
      ...entradaDeProyeccion(resumen, hoy),
      tiempo,
      cursosNuevos: escolar.cursos.map((c) => ({
        nombre: c.nombre,
        inicio: c.inicio,
        cambiadoEn: c.cambiadoEn,
      })),
    };
    avisos =
      momento === "manana"
        ? avisosDeHoy(entrada)
        : momento === "noche"
          ? avisosDeLaNoche(entrada)
          : avisosAntesDelCole(entrada);
  } catch (e) {
    console.error("[avisos] lectura", e instanceof Error ? e.message : "desconocido");
    return responder({ error: "no-disponible" }, 502);
  }
  if (momento !== "manana" && avisos.length === 0) {
    return responder({ enviado: false, motivo: "nada-que-avisar" }, 200);
  }

  // Cada canal va por su cuenta: que falle uno no impide el otro. Sin detalles hacia fuera.
  const resultado: {
    correo?: "ok" | "fallo" | "no-configurado";
    push?: { enviadas: number; caducadas: number; fallos: number };
  } = {};

  if (quiereCorreo && momento === "manana") {
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
      const mensaje =
        momento === "manana"
          ? notificacionDelDia(hoy, avisos)
          : momento === "noche"
            ? notificacionDeLaNoche(avisos)
            : notificacionAntesDelCole(avisos);
      for (const s of await leerSuscripciones(token)) {
        const r = await enviarPush(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          mensaje,
          undefined,
          claves,
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
