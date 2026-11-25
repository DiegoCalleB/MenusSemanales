import {
  AYUDA,
  BIENVENIDA,
  SIN_DATOS,
  hablarDeHoy,
  hablarDeLaCena,
  hablarDeLaCompra,
  hoyParaAlexa,
  peticionAlexaSchema,
  productosDe,
  respuesta,
  skillDe,
} from "@/dominio/alexa";
import { anadirCompraDesdeAlexa } from "@/infraestructura/alexa";
import { obtenerCertificadoDeAmazon, peticionDeAlexa } from "@/infraestructura/alexa-firma";
import {
  demasiadasPeticiones,
  leerResumenDelCalendario,
} from "@/infraestructura/calendario-suscrito";

const TOKEN = /^[0-9a-f]{64}$/;
const MAX_CUERPO = 20_000;

const json = (cuerpo: unknown, status = 200) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/**
 * La skill de Alexa (D-214): `POST /api/alexa/<token del calendario> (o ?t=)`. Tres cosas: «añade X a la
 * compra», «qué hay de cena» y «qué tengo hoy». Apagada mientras no esté `ALEXA_SKILL_ID` (el
 * identificador de la skill): solo contesta a esa skill y solo a peticiones con la firma de Amazon.
 * Por privacidad solo habla de compra, cena y citas.
 */
/** Lo mismo con el token en la ruta (`/api/alexa/<token>`) o en `?t=`. */
export async function manejar(request: Request, token: string) {
  const skillPermitida = process.env.ALEXA_SKILL_ID ?? "";
  if (!skillPermitida) return json({ error: "no-configurado" }, 503);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sin-ip";
  if (demasiadasPeticiones(`alexa-${ip}`, Date.now(), 120))
    return json({ error: "demasiadas" }, 429);

  if (!TOKEN.test(token)) return json({ error: "no-encontrado" }, 404);

  const cuerpo = await request.text();
  if (cuerpo.length === 0 || cuerpo.length > MAX_CUERPO) return json({ error: "no-valido" }, 400);
  let crudo: unknown;
  try {
    crudo = JSON.parse(cuerpo);
  } catch {
    return json({ error: "no-valido" }, 400);
  }
  const lectura = peticionAlexaSchema.safeParse(crudo);
  if (!lectura.success) return json({ error: "no-valido" }, 400);
  const peticion = lectura.data;

  // Quién la manda: la firma de Amazon y que sea nuestra skill (no la de otro).
  const firmada = await peticionDeAlexa({
    cuerpo,
    firma: request.headers.get("signature-256"),
    urlCertificados: request.headers.get("signaturecertchainurl"),
    timestamp: peticion.request.timestamp,
    ahora: new Date(),
    obtenerCertificado: obtenerCertificadoDeAmazon,
  });
  if (!firmada || skillDe(peticion) !== skillPermitida) return json({ error: "no-valido" }, 400);

  try {
    return json(await atender(peticion, token));
  } catch {
    return json(respuesta(SIN_DATOS));
  }
}

async function atender(peticion: ReturnType<typeof peticionAlexaSchema.parse>, token: string) {
  const { type, intent } = peticion.request;
  if (type === "LaunchRequest") return respuesta(BIENVENIDA, true);
  if (type === "SessionEndedRequest") return { version: "1.0", response: {} };
  if (type !== "IntentRequest" || !intent) return respuesta(AYUDA, true);

  switch (intent.name) {
    case "AnadirCompraIntent": {
      const productos = productosDe(intent.slots?.producto?.value);
      if (productos.length === 0) return respuesta("¿Qué quieres que apunte en la compra?", true);
      const resultados: Array<string | null> = [];
      for (const p of productos) resultados.push(await anadirCompraDesdeAlexa(token, p));
      if (resultados.every((r) => r === null)) {
        return respuesta("No encuentro vuestra casa. Revisa el enlace de la skill en la app.");
      }
      return respuesta(hablarDeLaCompra(productos, resultados));
    }
    case "CenaIntent":
    case "HoyIntent": {
      const resumen = await leerResumenDelCalendario(token);
      if (!resumen)
        return respuesta("No encuentro vuestra casa. Revisa el enlace de la skill en la app.");
      const hoy = hoyParaAlexa();
      return respuesta(
        intent.name === "CenaIntent" ? hablarDeLaCena(resumen, hoy) : hablarDeHoy(resumen, hoy),
      );
    }
    case "AMAZON.StopIntent":
    case "AMAZON.CancelIntent":
    case "AMAZON.NavigateHomeIntent":
      return respuesta("Vale.");
    default:
      return respuesta(AYUDA, true);
  }
}
