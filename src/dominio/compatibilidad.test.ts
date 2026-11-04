import { describe, expect, it } from "vitest";
import { compatibilidadConCole, textoCompatibilidad } from "./compatibilidad";
import type { MenuCole } from "./menu";

const cole = (c: Partial<MenuCole>): MenuCole => ({ primero: null, segundo: null, ...c });

describe("compatibilidad entre la cena y el cole", () => {
  it("no hay puntuación si no se sabe qué comieron", () => {
    expect(compatibilidadConCole({ grupo: "verdura", cole: null })).toBeNull();
    expect(compatibilidadConCole({ grupo: "verdura", cole: cole({}) })).toBeNull();
  });

  it("un 5 cuando lo aconsejan el primero y el segundo", () => {
    // Legumbre de primero (verdura, pasta o arroz) y de segundo (verdura o huevo): la verdura vale en las dos.
    const c = compatibilidadConCole({
      grupo: "verdura",
      cole: cole({ primero: "legumbre", segundo: "legumbre" }),
    });
    expect(c).toMatchObject({ puntos: 5, etiqueta: "Perfecta" });
    expect(c?.razones[0]).toContain("recomendador");
  });

  it("un 4 cuando solo lo aconseja uno de los dos platos", () => {
    // Pasta de primero aconseja verdura; carne de segundo aconseja huevo o pescado.
    const c = compatibilidadConCole({
      grupo: "verdura",
      cole: cole({ primero: "pasta", segundo: "carne" }),
    });
    expect(c?.puntos).toBe(4);
    expect(c?.razones[0]).toContain("tras uno de sus platos");
  });

  it("resta si repite lo que ya comieron y no lo aconseja nadie", () => {
    const c = compatibilidadConCole({
      grupo: "carne",
      cole: cole({ primero: "verdura", segundo: "carne" }),
    });
    expect(c?.puntos).toBe(2);
    expect(c?.razones.join(" ")).toContain("Repite carne");
  });

  it("un 1 si repite y además el cole fue contundente", () => {
    const c = compatibilidadConCole({
      grupo: "carne",
      cole: cole({ primero: "verdura", segundo: "carne", kcal: 760 }),
    });
    expect(c).toMatchObject({ puntos: 1, etiqueta: "Repite lo del cole" });
    expect(c?.razones.join(" ")).toContain("contundente");
  });

  it("las calorías compensan: cole contundente y cena ligera suma, y cole ligero con cena completa también", () => {
    const base = cole({ primero: "pasta", segundo: null });
    expect(compatibilidadConCole({ grupo: "verdura", cole: { ...base, kcal: 400 } })?.puntos).toBe(
      4,
    );
    expect(compatibilidadConCole({ grupo: "verdura", cole: { ...base, kcal: 750 } })?.puntos).toBe(
      5,
    );
    // Cole ligero y cena completa (arroz): el arroz no lo aconseja tras pasta, pero la cena es más completa.
    const ligero = compatibilidadConCole({ grupo: "arroz", cole: { ...base, kcal: 400 } });
    expect(ligero?.razones.join(" ")).toContain("más completa");
    expect(ligero?.puntos).toBe(4);
  });

  it("el equilibrio de la semana suma si falta el grupo y resta si ya está completo", () => {
    const base = cole({ primero: null, segundo: "carne" }); // aconseja huevo o pescado
    const falta = compatibilidadConCole({ grupo: "pescado", cole: base, semana: { pescado: 0 } });
    const completo = compatibilidadConCole({
      grupo: "pescado",
      cole: base,
      semana: { pescado: 4 },
    });
    const sinDato = compatibilidadConCole({ grupo: "pescado", cole: base });
    expect(falta?.puntos).toBe(5);
    expect(completo?.puntos).toBe(3);
    expect(sinDato?.puntos).toBe(4);
  });

  it("nunca sale de 1 a 5", () => {
    const peor = compatibilidadConCole({
      grupo: "carne",
      cole: cole({ primero: "carne", segundo: "carne", kcal: 900 }),
      semana: { carne: 5 },
    });
    expect(peor?.puntos).toBe(1);
  });

  it("un plato de «otro» tipo no se castiga por repetir", () => {
    const c = compatibilidadConCole({
      grupo: "otro",
      cole: cole({ primero: "otro", segundo: "carne" }),
    });
    expect(c?.razones.join(" ")).not.toContain("Repite");
  });

  it("el texto para lectores de pantalla", () => {
    const c = compatibilidadConCole({
      grupo: "verdura",
      cole: cole({ primero: "pasta", segundo: "carne" }),
    });
    expect(c && textoCompatibilidad(c)).toBe("Compatibilidad con el cole: 4 de 5, muy buena");
  });
});
