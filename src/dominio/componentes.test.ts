import { describe, expect, it } from "vitest";
import { componentesDe, faltanComponentes } from "./componentes";

const ing = (nombre: string, seccion: string) => ({ nombre, seccion }) as never;

describe("regla de oro de la cena", () => {
  it("reconoce proteína, hidrato, verdura y grasa por los ingredientes", () => {
    const merluzaConPatata = [
      ing("Merluza", "pescado"),
      ing("Patata", "fruta_verdura"),
      ing("Brócoli", "fruta_verdura"),
    ];
    expect([...componentesDe(merluzaConPatata)].sort()).toEqual(["hidrato", "proteina", "verdura"]);
    expect(componentesDe([ing("Aguacate", "fruta_verdura")]).has("grasa")).toBe(true);
    expect(componentesDe([ing("Lentejas", "despensa")]).has("proteina")).toBe(true);
    expect(componentesDe([ing("Guisantes", "congelados")]).has("verdura")).toBe(true);
    expect(componentesDe([ing("Pan", "panaderia")]).has("hidrato")).toBe(true);
  });

  it("la patata es hidrato, no verdura", () => {
    expect([...componentesDe([ing("Patata", "fruta_verdura")])]).toEqual(["hidrato"]);
  });

  it("dice qué falta, en el orden de la regla de oro", () => {
    expect(faltanComponentes([ing("Filete de ternera", "carne")])).toEqual([
      "hidrato",
      "verdura",
      "grasa",
    ]);
    expect(
      faltanComponentes([
        ing("Huevos", "huevos"),
        ing("Patata", "fruta_verdura"),
        ing("Tomate", "fruta_verdura"),
        ing("Aguacate", "fruta_verdura"),
      ]),
    ).toEqual([]);
    expect(faltanComponentes([])).toEqual(["proteina", "hidrato", "verdura", "grasa"]);
  });
});
