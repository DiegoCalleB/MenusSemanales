/**
 * Identificadores UUID para los datos que se guardan en tablas (D-088).
 *
 * Un cambio se calcula en el dispositivo y se envía a la base de datos con ids ya decididos, de
 * modo que repetirlo (por un reintento o por dos dispositivos que reciben la misma acción) no
 * duplica nada. Para eso el id no puede salir de un contador del documento: lo genera quien
 * despacha la acción (`idBase`, un UUID aleatorio) y el reductor, que es puro, deriva de él los
 * ids de cada fila de forma determinista (UUID v5, RFC 9562).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

/** Espacio de nombres para ids derivados de datos antiguos (los de antes de las tablas). */
export const ESPACIO_LEGADO = "6f0c2c0e-5d1e-4f43-9a55-3f1c1e0c7a10";

function sha1(bytes: Uint8Array): Uint8Array {
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const largo = bytes.length;
  const total = (((largo + 8) >> 6) + 1) << 6;
  const bloque = new Uint8Array(total);
  bloque.set(bytes);
  bloque[largo] = 0x80;
  const vista = new DataView(bloque.buffer);
  vista.setUint32(total - 8, Math.floor((largo * 8) / 0x100000000));
  vista.setUint32(total - 4, (largo * 8) >>> 0);
  const w = new Uint32Array(80);
  const rotar = (n: number, b: number) => ((n << b) | (n >>> (32 - b))) >>> 0;
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = vista.getUint32(i + t * 4);
    for (let t = 16; t < 80; t++) {
      w[t] = rotar((w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0), 1);
    }
    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const tmp = (rotar(a, 5) + (f >>> 0) + e + k + (w[t] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = rotar(b, 30);
      b = a;
      a = tmp;
    }
    h[0] = ((h[0] ?? 0) + a) >>> 0;
    h[1] = ((h[1] ?? 0) + b) >>> 0;
    h[2] = ((h[2] ?? 0) + c) >>> 0;
    h[3] = ((h[3] ?? 0) + d) >>> 0;
    h[4] = ((h[4] ?? 0) + e) >>> 0;
  }
  const salida = new Uint8Array(20);
  const v = new DataView(salida.buffer);
  h.forEach((x, i) => v.setUint32(i * 4, x));
  return salida;
}

function bytesDeUuid(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const salida = new Uint8Array(16);
  for (let i = 0; i < 16; i++) salida[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return salida;
}

/** UUID v5: el mismo espacio de nombres y el mismo nombre dan siempre el mismo UUID. */
export function uuidV5(nombre: string, espacio: string): string {
  if (!esUuid(espacio)) throw new Error("El espacio de nombres debe ser un UUID");
  const texto = new TextEncoder().encode(nombre);
  const ns = bytesDeUuid(espacio);
  const datos = new Uint8Array(ns.length + texto.length);
  datos.set(ns);
  datos.set(texto, ns.length);
  const h = sha1(datos).slice(0, 16);
  h[6] = ((h[6] ?? 0) & 0x0f) | 0x50;
  h[8] = ((h[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Id de una fila creada por una acción: se deriva del `idBase` de la acción y de la clave de la fila. */
export function idDerivado(idBase: string, clave: string): string {
  return uuidV5(clave, idBase);
}

/** Id estable para un dato antiguo (`c-3`, `a-5-0`…) de un hogar: permite importar sin duplicar. */
export function idDeLegado(hogarId: string, idAntiguo: string): string {
  return uuidV5(`${hogarId}|${idAntiguo}`, ESPACIO_LEGADO);
}
