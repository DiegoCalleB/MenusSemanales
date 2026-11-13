/*
 * Service worker de ¡Hecho! (D-115 notificaciones, D-129 uso sin conexión).
 *
 * Sin conexión la app tiene que abrirse y funcionar: los datos ya viven en el móvil y los cambios
 * se suben solos al volver internet (D-102); este archivo se ocupa de que la propia app (las
 * páginas y sus archivos) también esté en el móvil.
 *
 *  - Páginas: primero la red (si responde en pocos segundos, siempre se ve lo último) y, si no, la
 *    copia guardada de la última vez. Al instalarse guarda todas las pantallas de la app.
 *  - Archivos de Next (`/_next/static/`, con el contenido en el nombre) y las imágenes: primero lo
 *    guardado, que nunca cambia con el mismo nombre.
 *  - No toca NUNCA: lo que no sea GET, lo de otros dominios (Supabase) ni `/api/`.
 */
const VERSION = "v2";
const CACHE_PAGINAS = `hecho-paginas-${VERSION}`;
const CACHE_ESTATICOS = `hecho-estaticos-${VERSION}`;
/** Lo último que se ha compartido con la app desde otra (WhatsApp…), para que lo lea la página. */
const CACHE_COMPARTIDO = "hecho-compartido";
const ARCHIVO_COMPARTIDO = "/compartido/archivo";

/** Las pantallas de la app, para poder abrir cualquiera sin conexión aunque no se haya visitado. */
const RUTAS = [
  "/",
  "/menu",
  "/menu/cole",
  "/menu/platos",
  "/menu/emergencia",
  "/compra",
  "/despensa",
  "/casa",
  "/tareas",
  "/mochila",
  "/reparto",
  "/fechas",
  "/calendario",
  "/cumples",
  "/cuenta",
  "/personas",
  "/compartir",
  "/compartido",
  "/semana",
];
/** Imágenes y archivos sueltos de la app. */
const SUELTOS = ["/icon-192.png", "/icon-512.png", "/gatito.png", "/manifest.webmanifest"];

/** Si la red no contesta en este tiempo, se enseña lo guardado (internet «a medias»). */
const ESPERA_RED_MS = 4000;
/** Tope de archivos de Next guardados: al pasarse se borran los más antiguos. */
const MAX_ESTATICOS = 500;

/** Archivos de Next que cita una página (`/_next/static/...`), sin repetir. */
function extraerRecursos(html) {
  const salida = new Set();
  const patron = /(?:src|href)="(\/_next\/static\/[^"?#]+)/g;
  let m;
  while ((m = patron.exec(html)) !== null) salida.add(m[1]);
  return [...salida];
}

/** La clave con la que se guarda una página: su ruta, sin parámetros ni «#». */
function clavePagina(url) {
  const u = new URL(url, "https://ejemplo.invalid");
  const ruta = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
  return ruta || "/";
}

/**
 * La dirección a la que se manda a la app tras recibir algo compartido (D-138): el texto va en la
 * URL y, si llegó un archivo, se avisa con `archivo=1` (el archivo se queda en la caché).
 */
function destinoCompartido(campos, hayArchivo) {
  const q = new URLSearchParams();
  for (const k of ["title", "text", "url"]) {
    const v = typeof campos[k] === "string" ? campos[k].slice(0, 6000) : "";
    if (v) q.set(k, v);
  }
  if (hayArchivo) q.set("archivo", "1");
  const s = q.toString();
  return s ? `/compartido?${s}` : "/compartido";
}

/** ¿Es un archivo que se guarda y se sirve «primero lo guardado»? */
function esEstatico(ruta) {
  return ruta.startsWith("/_next/static/") || SUELTOS.includes(ruta);
}

const PAGINA_SIN_CONEXION =
  '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<title>Sin conexión · ¡Hecho!</title></head>" +
  '<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:32rem;margin:auto">' +
  "<h1>Sin conexión</h1>" +
  "<p>Esta pantalla aún no está guardada en el móvil. Ábrela una vez con internet y la próxima " +
  "vez funcionará también sin conexión.</p></body></html>";

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  const conTiempo = (promesa, ms) =>
    new Promise((resolver, rechazar) => {
      const t = setTimeout(() => rechazar(new Error("tiempo agotado")), ms);
      promesa.then(
        (r) => {
          clearTimeout(t);
          resolver(r);
        },
        (e) => {
          clearTimeout(t);
          rechazar(e);
        },
      );
    });

  /** Una respuesta que se puede guardar y servir más tarde para una navegación. */
  const guardable = (r) => r && r.ok && r.type === "basic" && !r.redirected;

  async function recortar(cache) {
    const claves = await cache.keys();
    for (let i = 0; i < claves.length - MAX_ESTATICOS; i++) await cache.delete(claves[i]);
  }

  async function guardarEstatico(url) {
    const cache = await caches.open(CACHE_ESTATICOS);
    if (await cache.match(url)) return;
    const r = await fetch(url, { credentials: "same-origin" });
    if (r.ok) await cache.put(url, r);
  }

  /** Guarda una pantalla y los archivos de Next que usa. */
  async function guardarPagina(ruta) {
    const r = await fetch(ruta, { cache: "reload", credentials: "same-origin" });
    if (!guardable(r)) return;
    const copia = r.clone();
    const html = await r.text();
    const paginas = await caches.open(CACHE_PAGINAS);
    await paginas.put(ruta, copia);
    await Promise.allSettled(extraerRecursos(html).map(guardarEstatico));
  }

  async function precachear() {
    await Promise.allSettled([...RUTAS.map(guardarPagina), ...SUELTOS.map(guardarEstatico)]);
  }

  async function pagina(peticion) {
    const clave = clavePagina(peticion.url);
    try {
      const r = await conTiempo(fetch(peticion), ESPERA_RED_MS);
      if (guardable(r)) {
        const copia = r.clone();
        caches.open(CACHE_PAGINAS).then((c) => c.put(clave, copia));
      }
      return r;
    } catch {
      const cache = await caches.open(CACHE_PAGINAS);
      // Primero esa pantalla; si nunca se guardó, la de inicio (la app), y si no, un aviso.
      const guardada = (await cache.match(clave)) || (await cache.match("/"));
      return (
        guardada ||
        new Response(PAGINA_SIN_CONEXION, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      );
    }
  }

  async function primeroLoGuardado(peticion) {
    const cache = await caches.open(CACHE_ESTATICOS);
    const guardado = await cache.match(peticion);
    if (guardado) return guardado;
    const r = await fetch(peticion);
    if (r.ok && r.type === "basic") {
      await cache.put(peticion, r.clone());
      await recortar(cache);
    }
    return r;
  }

  self.addEventListener("install", (evento) => {
    // Se activa en seguida y guarda toda la app; si algo falla, no impide instalarse.
    self.skipWaiting();
    evento.waitUntil(precachear());
  });

  self.addEventListener("activate", (evento) => {
    evento.waitUntil(
      (async () => {
        // Se borran las copias de versiones anteriores.
        const nombres = await caches.keys();
        await Promise.all(
          nombres
            .filter(
              (n) =>
                n.startsWith("hecho-") &&
                n !== CACHE_PAGINAS &&
                n !== CACHE_ESTATICOS &&
                n !== CACHE_COMPARTIDO,
            )
            .map((n) => caches.delete(n)),
        );
        await self.clients.claim();
      })(),
    );
  });

  /** Recibe lo compartido desde otra app (D-138): guarda el archivo y abre /compartido. */
  async function recibirCompartido(peticion) {
    try {
      const datos = await peticion.formData();
      const campos = {};
      for (const k of ["title", "text", "url"]) campos[k] = datos.get(k);
      const archivo = datos.getAll("archivo").find((f) => f && typeof f === "object" && f.size > 0);
      const cache = await caches.open(CACHE_COMPARTIDO);
      await cache.delete(ARCHIVO_COMPARTIDO);
      if (archivo) {
        await cache.put(
          ARCHIVO_COMPARTIDO,
          new Response(archivo, {
            headers: {
              "Content-Type": archivo.type || "application/octet-stream",
              "X-Nombre": encodeURIComponent(archivo.name || "archivo"),
            },
          }),
        );
      }
      return Response.redirect(destinoCompartido(campos, Boolean(archivo)), 303);
    } catch {
      return Response.redirect("/compartido", 303);
    }
  }

  self.addEventListener("fetch", (evento) => {
    const peticion = evento.request;
    if (peticion.method === "POST" && new URL(peticion.url).pathname === "/compartir-recibido") {
      evento.respondWith(recibirCompartido(peticion));
      return;
    }
    if (peticion.method !== "GET") return;
    const url = new URL(peticion.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;
    // Los audios y vídeos piden trozos (`Range`): se dejan pasar sin tocar.
    if (peticion.headers.has("range")) return;

    if (esEstatico(url.pathname)) {
      evento.respondWith(primeroLoGuardado(peticion));
    } else if (peticion.mode === "navigate") {
      evento.respondWith(pagina(peticion));
    }
    // Lo demás (datos de Next al cambiar de pantalla, etc.) va a la red tal cual: si falla sin
    // conexión, Next abre la pantalla entera y eso lo responde la rama de arriba.
  });

  /* Notificaciones de ¡Hecho! (D-115). Solo enseña el aviso y abre la app al tocarlo. */
  self.addEventListener("push", (evento) => {
    let datos = {};
    try {
      datos = evento.data ? evento.data.json() : {};
    } catch {
      datos = { cuerpo: evento.data ? evento.data.text() : "" };
    }
    const titulo =
      typeof datos.titulo === "string" && datos.titulo ? datos.titulo.slice(0, 100) : "¡Hecho!";
    const cuerpo = typeof datos.cuerpo === "string" ? datos.cuerpo.slice(0, 300) : "";
    evento.waitUntil(
      self.registration.showNotification(titulo, {
        body: cuerpo,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "avisos-diarios",
        data: { url: "/" },
      }),
    );
  });

  self.addEventListener("notificationclick", (evento) => {
    evento.notification.close();
    evento.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
        for (const v of ventanas) if ("focus" in v) return v.focus();
        return self.clients.openWindow("/");
      }),
    );
  });
}

// Para poder probar las funciones puras desde los tests (en el navegador `module` no existe).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { extraerRecursos, clavePagina, esEstatico, destinoCompartido, RUTAS, SUELTOS };
}
