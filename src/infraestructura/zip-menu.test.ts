import { deflateRawSync, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extraerDeZip } from "@/dominio/menu-cole-blog";

describe("lector de ZIP del menú del cole (D-173)", () => {
  it("saca un archivo de un ZIP (sin comprimir y comprimido), y nada si no está", () => {
    const zipDe = (archivos: Array<[string, Buffer, 0 | 8]>) => {
      const locales: Buffer[] = [];
      const centrales: Buffer[] = [];
      let pos = 0;
      for (const [nombre, datos, metodo] of archivos) {
        const comp = metodo === 8 ? deflateRawSync(datos) : datos;
        const n = Buffer.from(nombre);
        const l = Buffer.alloc(30);
        l.writeUInt32LE(0x04034b50, 0);
        l.writeUInt16LE(metodo, 8);
        l.writeUInt32LE(comp.length, 18);
        l.writeUInt32LE(datos.length, 22);
        l.writeUInt16LE(n.length, 26);
        const c = Buffer.alloc(46);
        c.writeUInt32LE(0x02014b50, 0);
        c.writeUInt16LE(metodo, 10);
        c.writeUInt32LE(comp.length, 20);
        c.writeUInt32LE(datos.length, 24);
        c.writeUInt16LE(n.length, 28);
        c.writeUInt32LE(pos, 42);
        locales.push(l, n, comp);
        centrales.push(c, n);
        pos += 30 + n.length + comp.length;
      }
      const dir = Buffer.concat(centrales);
      const fin = Buffer.alloc(22);
      fin.writeUInt32LE(0x06054b50, 0);
      fin.writeUInt16LE(archivos.length, 10);
      fin.writeUInt32LE(dir.length, 12);
      fin.writeUInt32LE(pos, 16);
      return Buffer.concat([...locales, dir, fin]);
    };
    const pdf = Buffer.from("%PDF-1.7 menu basal ".repeat(50));
    const zip = zipDe([
      ["MENÚ NOVIEMBRE/Menu_Sin lactosa.pdf", Buffer.from("otro"), 0],
      ["MENÚ NOVIEMBRE/Menu_Basal.pdf", pdf, 8],
    ]);
    const basal = extraerDeZip(zip, (n) => /(^|\/)Menu_Basal\.pdf$/i.test(n), inflateRawSync);
    expect(basal?.equals(pdf)).toBe(true);
    expect(
      extraerDeZip(zip, (n) => n.endsWith("Menu_Sin lactosa.pdf"), inflateRawSync)?.toString(),
    ).toBe("otro");
    expect(extraerDeZip(zip, () => false, inflateRawSync)).toBeNull();
    expect(extraerDeZip(Buffer.from("no es un zip"), () => true, inflateRawSync)).toBeNull();
  });
});
