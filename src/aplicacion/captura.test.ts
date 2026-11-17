import { describe, expect, it } from "vitest";
import type { ItemCaptura } from "@/dominio/ia-captura";
import { accionesDeCaptura, personaDe } from "./captura";
import { estadoInicialDemo } from "./datos-demo";
import { reducir } from "./estado";

const personas = [
  { id: "p-ana", nombre: "Ana", activa: true },
  { id: "p-alba", nombre: "Alba", activa: true },
  { id: "p-viejo", nombre: "Pedro", activa: false },
];
const item = (o: Partial<ItemCaptura>): ItemCaptura => ({
  tipo: "pendiente",
  titulo: "Llamar al fontanero",
  fecha: null,
  hasta: null,
  hora: null,
  persona: null,
  importante: false,
  repiteMeses: null,
  categoria: "otro",
  ...o,
});
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("captura: de lo que propone la IA a acciones (D-178)", () => {
  it("casa la persona sin tildes ni mayúsculas, y solo con la familia activa", () => {
    expect(personaDe("ana", personas)).toBe("p-ana");
    expect(personaDe(" ALBA ", personas)).toBe("p-alba");
    expect(personaDe("Pedro", personas)).toBeNull();
    expect(personaDe("Marta", personas)).toBeNull();
    expect(personaDe(null, personas)).toBeNull();
  });

  it("cada tipo se convierte en la acción de su pantalla", () => {
    const acciones = accionesDeCaptura(
      [
        item({ tipo: "compra", titulo: "2 litros de leche" }),
        item({ tipo: "evento", titulo: "Pediatra", fecha: "2026-11-19", hora: "18:00" }),
        item({
          tipo: "papel",
          titulo: "ITV",
          fecha: "2026-12-04",
          repiteMeses: 12,
          categoria: "coche",
        }),
        item({ titulo: "Arreglar la persiana", persona: "Ana", importante: true }),
      ],
      personas,
      id,
    );
    expect(acciones.map((a) => a.tipo)).toEqual([
      "manual/anadir",
      "agenda/cita",
      "vencimiento/guardar",
      "pendiente/anadir",
    ]);
    expect(acciones[3]).toMatchObject({ personaId: "p-ana", importante: true });
    expect(acciones[2]).toMatchObject({ categoria: "coche", repiteMeses: 12, avisos: [30, 7, 1] });
  });

  it("al aplicarlas, todo queda apuntado donde toca", () => {
    let e = estadoInicialDemo();
    for (const a of accionesDeCaptura(
      [
        item({ tipo: "compra", titulo: "pañales" }),
        item({ tipo: "evento", titulo: "Pediatra de Alba", fecha: "2026-11-19", hora: "18:00" }),
        item({
          tipo: "papel",
          titulo: "Seguro del coche",
          fecha: "2026-12-04",
          repiteMeses: 12,
          categoria: "coche",
        }),
        item({ titulo: "Llamar al fontanero" }),
      ],
      personas,
      id,
    )) {
      e = reducir(e, a);
    }
    expect(e.manuales.map((m) => m.nombre)).toContain("Pañales");
    expect(e.agenda.map((c) => [c.titulo, c.fecha, c.hora])).toContainEqual([
      "Pediatra de Alba",
      "2026-11-19",
      "18:00",
    ]);
    expect(e.vencimientos.map((v) => v.titulo)).toEqual(["Seguro del coche"]);
    expect(e.pendientes.map((p) => p.texto)).toEqual(["Llamar al fontanero"]);
  });
});
