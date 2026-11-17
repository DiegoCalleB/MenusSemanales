import { describe, expect, it } from "vitest";
import {
  INSTRUCCIONES_CAPTURA,
  depurarCaptura,
  mensajeParaCaptura,
  respuestaCapturaSchema,
} from "./ia-captura";

const item = (o: object = {}) => ({
  tipo: "pendiente" as const,
  titulo: "Llamar al fontanero",
  fecha: "",
  hasta: "",
  hora: "",
  persona: "",
  importante: false,
  repiteMeses: 0,
  categoria: "otro",
  ...o,
});
const HOY = "2026-11-17";

describe("una sola caja con IA (D-178)", () => {
  it("el mensaje lleva la fecha de hoy y las personas; las instrucciones, los cuatro tipos", () => {
    const m = mensajeParaCaptura(HOY, "martes", "comprar leche", ["Diego", "Ana"]);
    expect(m).toContain("martes 2026-11-17");
    expect(m).toContain("Diego, Ana");
    expect(m).toContain("<nota>\ncomprar leche\n</nota>");
    for (const t of ["compra", "evento", "pendiente", "papel"]) {
      expect(INSTRUCCIONES_CAPTURA).toContain(`"${t}"`);
    }
  });

  it("el esquema rechaza lo mal formado", () => {
    expect(respuestaCapturaSchema.safeParse({ items: [item()] }).success).toBe(true);
    expect(respuestaCapturaSchema.safeParse({ items: [item({ tipo: "otra" })] }).success).toBe(
      false,
    );
    expect(respuestaCapturaSchema.safeParse({ items: "x" }).success).toBe(false);
  });

  it("un evento o un papel sin fecha clara pasa a pendiente", () => {
    const r = depurarCaptura(
      [
        item({ tipo: "evento", titulo: "Reunión", fecha: "" }),
        item({ tipo: "papel", titulo: "Seguro", fecha: "mañana" }),
        item({ tipo: "evento", titulo: "Pediatra", fecha: "2026-11-19", hora: "18:00" }),
      ],
      HOY,
    );
    expect(r.items.map((i) => [i.tipo, i.titulo, i.fecha, i.hora])).toEqual([
      ["pendiente", "Reunión", null, null],
      ["pendiente", "Seguro", null, null],
      ["evento", "Pediatra", "2026-11-19", "18:00"],
    ]);
  });

  it("quita los eventos que ya pasaron, pero un papel vencido se queda", () => {
    const r = depurarCaptura(
      [
        item({ tipo: "evento", titulo: "Ya fue", fecha: "2026-11-10" }),
        item({ tipo: "evento", titulo: "Puente", fecha: "2026-11-10", hasta: "2026-11-18" }),
        item({
          tipo: "papel",
          titulo: "ITV",
          fecha: "2026-11-01",
          repiteMeses: 12,
          categoria: "coche",
        }),
      ],
      HOY,
    );
    expect(r.pasados).toBe(1);
    expect(r.items.map((i) => i.titulo)).toEqual(["Puente", "ITV"]);
    expect(r.items[1]).toMatchObject({ tipo: "papel", repiteMeses: 12, categoria: "coche" });
  });

  it("limpia horas, fechas, categorías y repetidos; la compra y el pendiente no llevan fecha", () => {
    const r = depurarCaptura(
      [
        item({
          tipo: "compra",
          titulo: " 2  litros de leche ",
          fecha: "2026-11-20",
          hora: "10:00",
        }),
        item({ tipo: "compra", titulo: "2 litros de leche" }),
        item({ tipo: "evento", titulo: "Cena", fecha: "2026-11-20", hora: "25:99" }),
        item({ tipo: "papel", titulo: "Pasaporte", fecha: "2030-05-01", categoria: "inventada" }),
        item({ titulo: "   " }),
      ],
      HOY,
    );
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ titulo: "2 litros de leche", fecha: null, hora: null });
    expect(r.items[1]).toMatchObject({ tipo: "evento", hora: null });
    expect(r.items[2]).toMatchObject({ categoria: "otro", repiteMeses: null });
  });

  it("guarda la persona tal cual y la importancia", () => {
    const r = depurarCaptura([item({ persona: " Ana ", importante: true })], HOY);
    expect(r.items[0]).toMatchObject({ persona: "Ana", importante: true });
  });
});
