import {
  AYUDA,
  BIENVENIDA,
  SIN_DATOS,
  accesoARecordatorios,
  hablarDeHoy,
  hablarDeLaCena,
  hablarDeLaCompra,
  hoyParaAlexa,
  peticionAlexaSchema,
  productosDe,
  respuesta,
  skillDe,
  vozDe,
} from "@/dominio/alexa";
import {
  buscarEnLaCompra,
  buscarTareaDeCasa,
  datosParaPreguntar,
  elegir,
  hablarDeLaCasa,
  hablarDeLaCompraApuntada,
  hablarDeLaMochila,
  hablarDeLoGuardado,
  hablarDeLoQueLeToca,
  hablarDeLosAvisos,
  hablarDeLosPapeles,
  hablarDeManana,
  hablarDePendientes,
  hablarDeSiHayEnLaCompra,
  hablarDelEstadio,
  hablarDelTiempo,
  pendientesDeSesion,
  personaPorNombre,
  planDeFrase,
  preguntaDeCita,
  saludoDeLaHora,
} from "@/dominio/conchi";
import { ahoraEnMadrid, cuandoSuena, PERMISO_RECORDATORIOS } from "@/dominio/recordatorio";
import {
  anadirCompraDesdeAlexa,
  anadirEntradaAlexa,
  avisarALaFamilia,
  deshacerLoUltimoDeAlexa,
  leerCompraDeAlexa,
  personaDeLaVoz,
  usarIaAlexa,
  vincularVozDeAlexa,
} from "@/infraestructura/alexa";
import { obtenerCertificadoDeAmazon, peticionDeAlexa } from "@/infraestructura/alexa-firma";
import { ponerRecordatorio } from "@/infraestructura/alexa-recordatorios";
import {
  demasiadasPeticiones,
  leerResumenDelCalendario,
} from "@/infraestructura/calendario-suscrito";
import { contestarPregunta, leerFrase } from "@/infraestructura/ia/conchi";
import { leerEventosEstadio } from "@/infraestructura/metropolitano";
import { leerPrevision } from "@/infraestructura/tiempo";

const TOKEN = /^[0-9a-f]{64}$/;
const MAX_CUERPO = 20_000;

const json = (cuerpo: unknown, status = 200) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/**
 * La skill de Alexa (D-214, D-215, D-216): `POST /api/alexa/<token del calendario> (o ?t=)`. Tres cosas: «añade X a la
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
type Resumen = NonNullable<Awaited<ReturnType<typeof leerResumenDelCalendario>>>;

const NO_CASA = "No encuentro vuestra casa. Revisa el enlace de la skill en la app.";
const SIN_CUPO =
  "Hoy ya he gastado todo mi cupo de inteligencia. Dime «añade leche» o apúntalo en la app.";
const REPREGUNTA = "¿Lo apunto? Di sí o no.";

/** Todo lo que cada petición necesita saber: quién la manda y qué se ha dicho. */
interface Contexto {
  token: string;
  peticion: Peticion;
  dicho: (slot: string) => string | undefined;
}

async function atender(peticion: Peticion, token: string) {
  const { type, intent } = peticion.request;
  if (type === "LaunchRequest") return bienvenida(token, peticion);
  if (type === "SessionEndedRequest") return { version: "1.0", response: {} };
  if (type !== "IntentRequest" || !intent) return respuesta(AYUDA, true);
  const c: Contexto = { token, peticion, dicho: (n) => intent.slots?.[n]?.value };

  switch (intent.name) {
    case "AnadirCompraIntent":
      return anadirCompra(c);
    case "ConchiIntent":
      return conchi(c);
    case "AMAZON.YesIntent":
    case "AMAZON.NoIntent":
      return confirmar(c, intent.name === "AMAZON.YesIntent");
    case "HechoIntent":
      return hecho(c);
    case "DeshacerIntent":
      return deshacer(c);
    case "QuitarCompraIntent":
      return quitarDeLaCompra(c);
    case "CompraIntent":
    case "HayEnCompraIntent":
      return leerCompra(c, intent.name === "HayEnCompraIntent");
    case "PreguntaIntent":
      return preguntar(c);
    case "SoyIntent":
      return soy(c);
    case "QueMeTocaIntent":
      return queMeToca(c);
    case "CenaIntent":
    case "HoyIntent":
    case "MananaIntent":
    case "MochilaIntent":
    case "CasaIntent":
    case "AvisosIntent":
    case "TiempoIntent":
    case "PendientesIntent":
    case "PapelesIntent":
    case "EstadioIntent":
      return leer(c, intent.name);
    case "AMAZON.StopIntent":
    case "AMAZON.CancelIntent":
    case "AMAZON.NavigateHomeIntent":
      return respuesta(elegir(["Vale.", "Hasta luego.", "Cuando quieras."]));
    default:
      return respuesta(AYUDA, true);
  }
}

/** Quién habla, si su voz ya está vinculada con alguien de la familia. */
async function quienHabla(c: Contexto, resumen: Resumen | null) {
  const voz = vozDe(c.peticion);
  if (!voz) return null;
  const id = await personaDeLaVoz(c.token, voz).catch(() => null);
  const p = resumen?.personas.find((x) => x.id === id);
  return id && p ? { id, nombre: p.nombre } : null;
}

async function bienvenida(token: string, peticion: Peticion) {
  const c: Contexto = { token, peticion, dicho: () => undefined };
  const voz = vozDe(peticion);
  let nombre = "";
  if (voz) {
    const resumen = await leerResumenDelCalendario(token).catch(() => null);
    nombre = (await quienHabla(c, resumen))?.nombre ?? "";
  }
  const saludo = saludoDeLaHora(ahoraEnMadrid().minutos);
  return respuesta(`${saludo}${nombre ? `, ${nombre}` : ""}. ${BIENVENIDA}`, true);
}

/** Avisa a los móviles de la familia, sin que un fallo estropee lo que ya se apuntó. */
const avisar = (token: string, texto: string) => avisarALaFamilia(token, texto).catch(() => false);

async function anadirCompra(c: Contexto) {
  const productos = productosDe(c.dicho("producto"));
  if (productos.length === 0) return respuesta("¿Qué quieres que apunte en la compra?", true);
  const resultados: Array<string | null> = [];
  for (const p of productos) resultados.push(await anadirCompraDesdeAlexa(c.token, p));
  if (resultados.every((r) => r === null)) return respuesta(NO_CASA);
  const hechos = productos.filter((_, i) => resultados[i] === "ok");
  if (hechos.length > 0) await avisar(c.token, `${hechos.join(", ")} en la compra`);
  return respuesta(hablarDeLaCompra(productos, resultados));
}

/**
 * Una frase libre («apunta pañales, el jueves a las seis el dentista y recuérdame a las nueve sacar
 * la basura»): la IA la reparte; la compra y los pendientes se guardan en el acto; los recordatorios
 * con hora los pone Alexa; y las citas se confirman en voz alta antes de guardar.
 */
async function conchi(c: Contexto) {
  const texto = (c.dicho("frase") ?? "").trim();
  if (texto.length < 3) return respuesta("¿Qué quieres que apunte?", true);
  const [uso, resumen] = await Promise.all([
    usarIaAlexa(c.token),
    leerResumenDelCalendario(c.token),
  ]);
  if (uso === null || !resumen) return respuesta(NO_CASA);
  if (uso === "tope") return respuesta(SIN_CUPO);
  const ahora = ahoraEnMadrid();
  const hoy = hoyParaAlexa();
  let items;
  try {
    items = await leerFrase({
      hoy,
      hora: `${String(Math.floor(ahora.minutos / 60)).padStart(2, "0")}:${String(ahora.minutos % 60).padStart(2, "0")}`,
      texto,
      personas: resumen.personas.filter((p) => p.activa).map((p) => p.nombre),
    });
  } catch {
    return respuesta(
      "No he podido entenderlo ahora. Prueba con «añade leche» o apúntalo en la app.",
    );
  }
  const { directas, porConfirmar, recordatorios } = planDeFrase(items, ahora);
  if (directas.length + porConfirmar.length + recordatorios.length === 0) {
    return respuesta("No he entendido qué apuntar. Prueba a decirlo de otra forma.", true);
  }

  const dicho: string[] = [];
  const guardadas = [];
  let sinCupo = false;
  for (const d of directas) {
    const r = await anadirEntradaAlexa(c.token, d);
    if (r === "ok") guardadas.push(d);
    else if (r === "demasiadas") sinCupo = true;
  }
  if (guardadas.length > 0) {
    dicho.push(hablarDeLoGuardado(guardadas));
    await avisar(c.token, guardadas.map((g) => g.texto).join(", "));
  }
  if (sinCupo) dicho.push("Hoy has pedido muchas cosas por voz; el resto, desde la app.");

  // Recordatorios con hora: los pone Alexa con el permiso de quien habla.
  let pedirPermiso = false;
  if (recordatorios.length > 0) {
    const acceso = accesoARecordatorios(c.peticion);
    for (const r of recordatorios) {
      const puesto = acceso ? await ponerRecordatorio(acceso, r) : "sin-permiso";
      if (puesto === "ok") {
        dicho.push(`Te lo recordaré ${cuandoSuena(r.fecha, r.hora, hoy)}: ${r.texto}.`);
      } else if (puesto === "sin-permiso") {
        pedirPermiso = true;
      } else {
        dicho.push(`No he podido poner el recordatorio de ${r.texto}.`);
      }
    }
    if (pedirPermiso) {
      dicho.push(
        "Para poner recordatorios necesito tu permiso. Te he mandado una tarjeta a la app de Alexa; acéptala y vuelve a pedírmelo.",
      );
    }
  }

  if (porConfirmar.length === 0 || sinCupo || pedirPermiso) {
    return respuesta(dicho.join(" ") || "No he podido apuntarlo.", false, {
      ...(pedirPermiso ? { pedirPermisos: [PERMISO_RECORDATORIOS] } : {}),
    });
  }
  const primera = porConfirmar[0];
  if (!primera) return respuesta(dicho.join(" "));
  return respuesta([...dicho, preguntaDeCita(primera, hoy)].join(" "), true, {
    atributos: { porConfirmar },
    repregunta: REPREGUNTA,
  });
}

/** El «sí» o el «no» a «¿Apunto…?»: guarda o descarta la primera cita y pregunta por la siguiente. */
async function confirmar(c: Contexto, si: boolean) {
  const [actual, ...resto] = pendientesDeSesion(c.peticion.session?.attributes);
  if (!actual) return respuesta("No tenía nada pendiente de confirmar.");
  let dicho = elegir(["Vale, no lo apunto.", "De acuerdo, lo dejo."]);
  if (si) {
    const ok = (await anadirEntradaAlexa(c.token, actual)) === "ok";
    dicho = ok ? elegir(["Apuntado.", "Anotado.", "Listo."]) : "No he podido apuntarlo.";
    if (ok) await avisar(c.token, `${actual.texto} (cita)`);
  }
  const siguiente = resto[0];
  if (!siguiente) return respuesta(dicho);
  return respuesta(`${dicho} ${preguntaDeCita(siguiente, hoyParaAlexa())}`, true, {
    atributos: { porConfirmar: resto },
    repregunta: REPREGUNTA,
  });
}

/** «Ya he hecho la colada»: se busca entre las tareas de casa y se marca desde la app. */
async function hecho(c: Contexto) {
  const resumen = await leerResumenDelCalendario(c.token);
  if (!resumen) return respuesta(NO_CASA);
  const titulo = buscarTareaDeCasa(resumen, c.dicho("tarea"));
  if (!titulo) {
    return respuesta("No sé qué tarea de casa es esa. Dime su nombre como sale en la app.", true);
  }
  const ok =
    (await anadirEntradaAlexa(c.token, {
      tipo: "hecha",
      texto: titulo,
      fecha: null,
      hora: null,
    })) === "ok";
  if (ok) await avisar(c.token, `${titulo}, hecho`);
  return respuesta(ok ? `Marcado como hecho: ${titulo}.` : "No he podido marcarlo.");
}

const COMO_DECIRLO: Record<string, string> = {
  compra: "de la compra",
  pendiente: "de pendientes",
  cita: "de las fechas",
};

/** «Borra lo último»: quita lo último que se apuntó por voz (compra, pendiente o cita). */
async function deshacer(c: Contexto) {
  const quitado = await deshacerLoUltimoDeAlexa(c.token);
  if (!quitado) return respuesta("No hay nada que deshacer.");
  return respuesta(
    `Quitado ${COMO_DECIRLO[quitado.tipo] ?? ""}: ${quitado.texto}.`.replace("  ", " "),
  );
}

/** «Quita la leche de la compra». */
async function quitarDeLaCompra(c: Contexto) {
  const lista = await leerCompraDeAlexa(c.token);
  if (lista === null) return respuesta(NO_CASA);
  const nombre = buscarEnLaCompra(lista, c.dicho("producto"));
  if (!nombre)
    return respuesta(
      "No encuentro eso en la compra, o hay más de uno parecido. Dime su nombre completo.",
      true,
    );
  const ok =
    (await anadirEntradaAlexa(c.token, {
      tipo: "quitar_compra",
      texto: nombre,
      fecha: null,
      hora: null,
    })) === "ok";
  return respuesta(ok ? `Quitado de la compra: ${nombre}.` : "No he podido quitarlo.");
}

/** «Qué hay en la compra» y «hay leche en la compra». */
async function leerCompra(c: Contexto, concreto: boolean) {
  const lista = await leerCompraDeAlexa(c.token);
  if (lista === null) return respuesta(NO_CASA);
  return respuesta(
    concreto
      ? hablarDeSiHayEnLaCompra(lista, c.dicho("producto"))
      : hablarDeLaCompraApuntada(lista),
  );
}

/** «Soy Diego»: vincula esta voz de Alexa con esa persona de la familia. */
async function soy(c: Contexto) {
  const voz = vozDe(c.peticion);
  if (!voz) {
    return respuesta(
      "Todavía no reconozco tu voz. Crea tu perfil de voz en la app de Alexa y activa la personalización para esta skill; luego dímelo otra vez.",
    );
  }
  const resumen = await leerResumenDelCalendario(c.token);
  if (!resumen) return respuesta(NO_CASA);
  const p = personaPorNombre(resumen, c.dicho("nombre"));
  if (!p)
    return respuesta(
      "No encuentro a nadie con ese nombre en la familia. Dímelo como sale en la app.",
      true,
    );
  const r = await vincularVozDeAlexa(c.token, voz, p.id);
  return respuesta(
    r === "ok" ? `Encantada, ${p.nombre}. Ya sé cuál es tu voz.` : "No he podido recordar tu voz.",
  );
}

/** «Qué me toca»: las tareas de casa de hoy de quien habla. */
async function queMeToca(c: Contexto) {
  const resumen = await leerResumenDelCalendario(c.token);
  if (!resumen) return respuesta(NO_CASA);
  const yo = await quienHabla(c, resumen);
  if (!yo)
    return respuesta("Todavía no sé quién eres. Dime «soy» y tu nombre, y lo recordaré.", true);
  return respuesta(hablarDeLoQueLeToca(resumen, hoyParaAlexa(), yo.id));
}

/** Una pregunta libre: la IA contesta solo con los datos de la casa. */
async function preguntar(c: Contexto) {
  const pregunta = (c.dicho("pregunta") ?? "").trim();
  if (pregunta.length < 3) return respuesta("¿Qué quieres saber?", true);
  const [uso, resumen] = await Promise.all([
    usarIaAlexa(c.token),
    leerResumenDelCalendario(c.token),
  ]);
  if (uso === null || !resumen) return respuesta(NO_CASA);
  if (uso === "tope") return respuesta(SIN_CUPO);
  const hoy = hoyParaAlexa();
  const estadio = await leerEventosEstadio(hoy).catch(() => []);
  try {
    const contestada = await contestarPregunta({
      hoy,
      pregunta,
      datos: datosParaPreguntar(resumen, hoy, estadio),
    });
    return respuesta(contestada ?? "Eso no lo tengo apuntado.");
  } catch {
    return respuesta("No he podido pensarlo ahora. Prueba con una pregunta más corta.");
  }
}

/** Lo que Conchi lee: sale del mismo resumen del hogar que el calendario suscrito. */
async function leer(c: Contexto, intencion: string) {
  const resumen = await leerResumenDelCalendario(c.token);
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
    case "PendientesIntent":
      return respuesta(hablarDePendientes(resumen));
    case "PapelesIntent":
      return respuesta(hablarDeLosPapeles(resumen, hoy));
    case "EstadioIntent":
      return respuesta(hablarDelEstadio(await leerEventosEstadio(hoy).catch(() => []), hoy));
    default:
      return respuesta(hablarDeLosAvisos(resumen, hoy, await tiempo()));
  }
}
