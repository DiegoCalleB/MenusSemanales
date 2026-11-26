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
import {
  buscarTareaDeCasa,
  hablarDeLaCasa,
  hablarDeLaMochila,
  hablarDeLoGuardado,
  hablarDeLosAvisos,
  hablarDeManana,
  hablarDelTiempo,
  pendientesDeSesion,
  planDeFrase,
  preguntaDeCita,
} from "@/dominio/conchi";
import { anadirCompraDesdeAlexa, anadirEntradaAlexa, usarIaAlexa } from "@/infraestructura/alexa";
import { obtenerCertificadoDeAmazon, peticionDeAlexa } from "@/infraestructura/alexa-firma";
import {
  demasiadasPeticiones,
  leerResumenDelCalendario,
} from "@/infraestructura/calendario-suscrito";
import { leerCaptura } from "@/infraestructura/ia/captura";
import { leerPrevision } from "@/infraestructura/tiempo";

const TOKEN = /^[0-9a-f]{64}$/;
const MAX_CUERPO = 20_000;

const json = (cuerpo: unknown, status = 200) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/**
 * La skill de Alexa (D-214, D-215): `POST /api/alexa/<token del calendario> (o ?t=)`. Tres cosas: «añade X a la
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

type Peticion = ReturnType<typeof peticionAlexaSchema.parse>;

const NO_CASA = "No encuentro vuestra casa. Revisa el enlace de la skill en la app.";
/** Alexa corta a los 8 segundos: la IA tiene menos que eso. */
const PLAZOS_IA = { plazoMs: 5500, porIntentoMs: 5000 } as const;

async function atender(peticion: Peticion, token: string) {
  const { type, intent } = peticion.request;
  if (type === "LaunchRequest") return respuesta(BIENVENIDA, true);
  if (type === "SessionEndedRequest") return { version: "1.0", response: {} };
  if (type !== "IntentRequest" || !intent) return respuesta(AYUDA, true);
  const dicho = (nombre: string) => intent.slots?.[nombre]?.value;

  switch (intent.name) {
    case "AnadirCompraIntent": {
      const productos = productosDe(dicho("producto"));
      if (productos.length === 0) return respuesta("¿Qué quieres que apunte en la compra?", true);
      const resultados: Array<string | null> = [];
      for (const p of productos) resultados.push(await anadirCompraDesdeAlexa(token, p));
      if (resultados.every((r) => r === null)) return respuesta(NO_CASA);
      return respuesta(hablarDeLaCompra(productos, resultados));
    }
    case "ConchiIntent":
      return conchi(token, dicho("frase"));
    case "AMAZON.YesIntent":
    case "AMAZON.NoIntent":
      return confirmar(token, peticion.session?.attributes, intent.name === "AMAZON.YesIntent");
    case "HechoIntent":
      return hecho(token, dicho("tarea"));
    case "CenaIntent":
    case "HoyIntent":
    case "MananaIntent":
    case "MochilaIntent":
    case "CasaIntent":
    case "AvisosIntent":
      return leer(token, intent.name);
    case "TiempoIntent":
      return leer(token, "TiempoIntent");
    case "AMAZON.StopIntent":
    case "AMAZON.CancelIntent":
    case "AMAZON.NavigateHomeIntent":
      return respuesta("Vale.");
    default:
      return respuesta(AYUDA, true);
  }
}

/** Lo que Conchi lee: sale del mismo resumen del hogar que el calendario suscrito. */
async function leer(token: string, intencion: string) {
  const resumen = await leerResumenDelCalendario(token);
  if (!resumen) return respuesta(NO_CASA);
  const hoy = hoyParaAlexa();
  const tiempo = () => leerPrevision().catch(() => []);
  switch (intencion) {
    case "CenaIntent":
      return respuesta(hablarDeLaCena(resumen, hoy));
    case "HoyIntent":
      return respuesta(hablarDeHoy(resumen, hoy));
    case "MananaIntent":
      return respuesta(hablarDeManana(resumen, hoy));
    case "MochilaIntent":
      return respuesta(hablarDeLaMochila(resumen, hoy));
    case "CasaIntent":
      return respuesta(hablarDeLaCasa(resumen, hoy));
    case "TiempoIntent":
      return respuesta(hablarDelTiempo(resumen, hoy, await tiempo()));
    default:
      return respuesta(hablarDeLosAvisos(resumen, hoy, await tiempo()));
  }
}

/**
 * Una frase libre («apunta el jueves a las seis el dentista y compra pañales»): la IA la reparte; la
 * compra y los pendientes se guardan en el acto; las citas se confirman en voz alta antes de guardar.
 */
async function conchi(token: string, frase: string | undefined) {
  const texto = (frase ?? "").trim();
  if (texto.length < 3) return respuesta("¿Qué quieres que apunte?", true);
  const [uso, resumen] = await Promise.all([usarIaAlexa(token), leerResumenDelCalendario(token)]);
  if (uso === null || !resumen) return respuesta(NO_CASA);
  if (uso === "tope") {
    return respuesta(
      "Hoy ya he gastado todo mi cupo de inteligencia. Dime «añade leche» o apúntalo en la app.",
    );
  }
  const personas = resumen.personas.filter((p) => p.activa).map((p) => p.nombre);
  let items;
  try {
    items = (await leerCaptura({ hoy: hoyParaAlexa(), texto, personas }, fetch, PLAZOS_IA)).items;
  } catch {
    return respuesta(
      "No he podido entenderlo ahora. Prueba con «añade leche» o apúntalo en la app.",
    );
  }
  const { directas, porConfirmar } = planDeFrase(items);
  if (directas.length === 0 && porConfirmar.length === 0) {
    return respuesta("No he entendido qué apuntar. Prueba a decirlo de otra forma.", true);
  }
  const guardadas = [];
  let sinCupo = false;
  for (const d of directas) {
    const r = await anadirEntradaAlexa(token, d);
    if (r === "ok") guardadas.push(d);
    else if (r === "demasiadas") sinCupo = true;
  }
  const dicho_ = [
    hablarDeLoGuardado(guardadas),
    sinCupo ? "Hoy has pedido muchas cosas por voz; el resto, desde la app." : "",
  ];
  if (porConfirmar.length === 0 || sinCupo) {
    return respuesta(dicho_.filter(Boolean).join(" ") || "No he podido apuntarlo.");
  }
  return respuesta(
    [...dicho_, preguntaDeCita(porConfirmar[0]!, hoyParaAlexa())].filter(Boolean).join(" "),
    true,
    {
      atributos: { porConfirmar },
      repregunta: "¿Lo apunto? Di sí o no.",
    },
  );
}

/** El «sí» o el «no» a «¿Apunto…?»: guarda o descarta la primera cita y pregunta por la siguiente. */
async function confirmar(
  token: string,
  atributos: Record<string, unknown> | undefined,
  si: boolean,
) {
  const [actual, ...resto] = pendientesDeSesion(atributos);
  if (!actual) return respuesta("No tenía nada pendiente de confirmar.");
  let dicho_ = "Vale, no lo apunto.";
  if (si)
    dicho_ =
      (await anadirEntradaAlexa(token, actual)) === "ok" ? "Apuntado." : "No he podido apuntarlo.";
  const siguiente = resto[0];
  if (!siguiente) return respuesta(dicho_);
  return respuesta(`${dicho_} ${preguntaDeCita(siguiente, hoyParaAlexa())}`, true, {
    atributos: { porConfirmar: resto },
    repregunta: "¿Lo apunto? Di sí o no.",
  });
}

/** «Ya he hecho la colada»: se busca entre las tareas de casa y se marca desde la app. */
async function hecho(token: string, tarea: string | undefined) {
  const resumen = await leerResumenDelCalendario(token);
  if (!resumen) return respuesta(NO_CASA);
  const titulo = buscarTareaDeCasa(resumen, tarea);
  if (!titulo) {
    return respuesta("No sé qué tarea de casa es esa. Dime su nombre como sale en la app.", true);
  }
  const r = await anadirEntradaAlexa(token, {
    tipo: "hecha",
    texto: titulo,
    fecha: null,
    hora: null,
  });
  return respuesta(r === "ok" ? `Marcado como hecho: ${titulo}.` : "No he podido marcarlo.");
}
