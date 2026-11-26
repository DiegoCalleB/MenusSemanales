import { X509Certificate, createVerify, type KeyObject } from "node:crypto";
import { rootCertificates } from "node:tls";

/**
 * Comprobar que una petición viene de verdad de Alexa (D-214), como exige Amazon: la dirección de
 * los certificados, el certificado (vigente, para echo-api.amazon.com y firmado por una entidad de
 * confianza), la firma del cuerpo y que la petición sea de hace menos de 150 segundos. Sin esto,
 * cualquiera que conozca el enlace podría apuntar cosas a la compra.
 */

export interface Certificado {
  clavePublica: KeyObject;
  nombres: string[];
  desde: Date;
  hasta: Date;
}

/** La dirección de los certificados que Amazon permite (https, s3.amazonaws.com, /echo.api/). */
export function urlDeCertificadosValida(valor: string | null | undefined): boolean {
  if (!valor) return false;
  let u: URL;
  try {
    u = new URL(valor);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== "s3.amazonaws.com") return false;
  if (u.port !== "" && u.port !== "443") return false;
  if (u.username || u.password) return false;
  // Sin «..» ni formas escapadas: la ruta tal cual debe empezar por /echo.api/.
  return u.pathname.startsWith("/echo.api/") && !u.pathname.includes("..");
}

/** La petición es reciente (Amazon pide menos de 150 segundos de diferencia). */
export function fechaReciente(timestamp: string | undefined, ahora: Date): boolean {
  if (!timestamp) return false;
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return false;
  return Math.abs(ahora.getTime() - t) <= 150_000;
}

export interface Entrada {
  cuerpo: string;
  firma: string | null;
  urlCertificados: string | null;
  timestamp: string | undefined;
  ahora: Date;
  obtenerCertificado: (url: string) => Promise<Certificado | null>;
}

export async function peticionDeAlexa(e: Entrada): Promise<boolean> {
  if (!urlDeCertificadosValida(e.urlCertificados) || !e.firma) return false;
  if (!fechaReciente(e.timestamp, e.ahora)) return false;
  let cert: Certificado | null;
  try {
    cert = await e.obtenerCertificado(e.urlCertificados as string);
  } catch {
    return false;
  }
  if (!cert) return false;
  if (e.ahora < cert.desde || e.ahora > cert.hasta) return false;
  if (!cert.nombres.includes("echo-api.amazon.com")) return false;
  try {
    const v = createVerify("RSA-SHA256");
    v.update(e.cuerpo);
    return v.verify(cert.clavePublica, e.firma, "base64");
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------------------------
// El certificado de verdad: se baja de Amazon, se comprueba la cadena y se guarda una hora.
// ----------------------------------------------------------------------------------------------

const confianza = rootCertificates.map((pem) => new X509Certificate(pem));
const guardados = new Map<string, { hasta: number; cert: Certificado }>();
const UNA_HORA = 3_600_000;

/** Partes de un PEM con varios certificados. */
const certificadosDe = (pem: string): X509Certificate[] =>
  (pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [])
    .slice(0, 5)
    .map((p) => new X509Certificate(p));

const nombresDe = (c: X509Certificate): string[] =>
  (c.subjectAltName ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.startsWith("DNS:"))
    .map((x) => x.slice(4).toLowerCase());

/**
 * Se recorre la cadena desde el certificado de Amazon: cada uno vigente y firmado por el siguiente,
 * hasta llegar a uno que sea una entidad raíz de confianza o esté firmado por una (las cadenas de
 * Amazon terminan a veces en una raíz con firma cruzada: lo que venga después no hace falta).
 */
export function cadenaDeConfianza(cadena: readonly X509Certificate[], ahora: Date): boolean {
  for (let i = 0; i < cadena.length; i++) {
    const c = cadena[i] as X509Certificate;
    if (ahora < new Date(c.validFrom) || ahora > new Date(c.validTo)) return false;
    if (confianza.some((r) => c.fingerprint256 === r.fingerprint256)) return true;
    if (confianza.some((r) => c.checkIssued(r) && c.verify(r.publicKey))) return true;
    const emisor = cadena[i + 1];
    if (!emisor || !c.checkIssued(emisor) || !c.verify(emisor.publicKey)) return false;
  }
  return false;
}

export async function obtenerCertificadoDeAmazon(url: string): Promise<Certificado | null> {
  const ahora = Date.now();
  const antes = guardados.get(url);
  if (antes && antes.hasta > ahora) return antes.cert;
  const r = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!r.ok) return null;
  const pem = (await r.text()).slice(0, 64_000);
  const cadena = certificadosDe(pem);
  const primero = cadena[0];
  if (!primero || !cadenaDeConfianza(cadena, new Date(ahora))) return null;
  const cert: Certificado = {
    clavePublica: primero.publicKey,
    nombres: nombresDe(primero),
    desde: new Date(primero.validFrom),
    hasta: new Date(primero.validTo),
  };
  if (guardados.size > 20) guardados.clear();
  guardados.set(url, { hasta: ahora + UNA_HORA, cert });
  return cert;
}
