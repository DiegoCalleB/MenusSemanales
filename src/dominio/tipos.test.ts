import { describe, expect, it } from "vitest";
import {
  cargaSchema,
  itemDespensaSchema,
  movimientoSchema,
  personaSchema,
  racionesDe,
  turnoSchema,
} from "./tipos";

describe("esquemas del dominio", () => {
  it("un movimiento de cantidad cero no es válido", () => {
    expect(
      movimientoSchema.safeParse({ ingredienteId: "a", ubicacion: "nevera", delta: 0 }).success,
    ).toBe(false);
    expect(
      movimientoSchema.safeParse({ ingredienteId: "a", ubicacion: "nevera", delta: -1 }).success,
    ).toBe(true);
  });

  it("una ubicación desconocida se rechaza", () => {
    expect(
      movimientoSchema.safeParse({ ingredienteId: "a", ubicacion: "garaje", delta: 1 }).success,
    ).toBe(false);
  });

  it("el stock no puede ser negativo y la caducidad debe ser AAAA-MM-DD", () => {
    expect(
      itemDespensaSchema.safeParse({ ingredienteId: "a", ubicacion: "nevera", cantidad: -1 })
        .success,
    ).toBe(false);
    expect(
      itemDespensaSchema.safeParse({
        ingredienteId: "a",
        ubicacion: "nevera",
        cantidad: 1,
        caducaEn: "mañana",
      }).success,
    ).toBe(false);
    const ok = itemDespensaSchema.parse({ ingredienteId: "a", ubicacion: "nevera", cantidad: 1 });
    expect(ok).toMatchObject({ minimo: null, caducaEn: null });
  });

  it("aplica los valores por defecto de personas, cargas y turnos", () => {
    expect(personaSchema.parse({ id: "p", nombre: "Ana", tipo: "adulto" })).toMatchObject({
      activa: true,
      factorRacion: 1,
    });
    expect(
      cargaSchema.parse({ id: "c", nombre: "Cenas", tipo: "cena", esfuerzoMin: 40 }),
    ).toMatchObject({
      planificacionMin: 0,
      responsableId: null,
      activa: true,
    });
    expect(turnoSchema.parse({ cargaId: "c", fecha: "2026-11-03", personaId: "p" }).estado).toBe(
      "pendiente",
    );
  });

  it("una carga sin esfuerzo o con esfuerzo desmedido no es válida", () => {
    expect(
      cargaSchema.safeParse({ id: "c", nombre: "x", tipo: "tarea", esfuerzoMin: 0 }).success,
    ).toBe(false);
    expect(
      cargaSchema.safeParse({ id: "c", nombre: "x", tipo: "tarea", esfuerzoMin: 481 }).success,
    ).toBe(false);
  });

  it("las raciones de una mesa suman los factores de ración (D-012)", () => {
    const familia = [
      { factorRacion: 1 },
      { factorRacion: 1 },
      { factorRacion: 0.5 },
      { factorRacion: 0.5 },
    ];
    expect(racionesDe(familia)).toBe(3);
    expect(racionesDe([])).toBe(0);
  });
});
