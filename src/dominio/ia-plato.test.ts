import { describe, expect, it } from "vitest";
import {
  enlazarConCatalogo,
  mensajeParaPlato,
  peticionPlatoSchema,
  propuestaPlatoSchema,
  redondear,
} from "./ia-plato";

const catalogo = [
  { id: "i-1", nombre: "Pechuga de pollo", unidad: "g" as const },
  { id: "i-2", nombre: "Huevos", unidad: "ud" as const },
  { id: "i-3", nombre: "Pan rallado", unidad: "g" as const },
];
const ing = (nombre: string, cantidad: number, unidad: "g" | "ml" | "ud" = "g") => ({
  nombre,
  cantidad,
  unidad,
  seccion: "otros" as const,
  opcional: false,
});

describe("completar un plato con IA", () => {
  it("la petición exige nombre y limita el catálogo", () => {
    expect(peticionPlatoSchema.safeParse({ nombre: "x" }).success).toBe(false);
    expect(peticionPlatoSchema.parse({ nombre: "Pollo empanado" }).catalogo).toEqual([]);
    const grande = Array.from({ length: 401 }, (_, i) => ({ nombre: `i${i}`, unidad: "g" }));
    expect(peticionPlatoSchema.safeParse({ nombre: "Pollo", catalogo: grande }).success).toBe(
      false,
    );
  });

  it("el mensaje separa el plato, que es un dato, de los ingredientes que ya existen", () => {
    const m = mensajeParaPlato(
      peticionPlatoSchema.parse({
        nombre: "Pollo empanado",
        catalogo: [{ nombre: "Huevos", unidad: "ud" }],
      }),
    );
    expect(m).toContain("<plato>\nPollo empanado\n</plato>");
    expect(m).toContain("- Huevos (ud)");
  });

  it("empareja con el catálogo sin importar mayúsculas, tildes ni plural", () => {
    const filas = enlazarConCatalogo(
      [
        ing("pechuga de pollo", 150),
        ing("Huevo", 1, "ud"),
        ing("Pan rallado", 40),
        ing("Limón", 0.5, "ud"),
      ],
      catalogo,
    );
    expect(filas.map((f) => [f.nombre, f.ingredienteId])).toEqual([
      ["Pechuga de pollo", "i-1"],
      ["Huevos", "i-2"],
      ["Pan rallado", "i-3"],
      ["Limón", null],
    ]);
  });

  it("usa la unidad del catálogo y avisa si la IA discrepa", () => {
    const [f] = enlazarConCatalogo([ing("Huevos", 100, "g")], catalogo);
    expect(f).toMatchObject({ unidad: "ud", revisarUnidad: true });
    const [g] = enlazarConCatalogo([ing("Huevos", 1, "ud")], catalogo);
    expect(g?.revisarUnidad).toBe(false);
  });

  it("quita repetidos y redondea a algo que se pueda pesar", () => {
    const filas = enlazarConCatalogo(
      [ing("Pan rallado", 41), ing("pan rallado", 60), ing("Leche", 123, "ml")],
      catalogo,
    );
    expect(filas.map((f) => f.cantidad)).toEqual([40, 125]);
    expect(redondear(0.3, "ud")).toBe(0.5);
    expect(redondear(1.2, "ud")).toBe(1);
    expect(redondear(1, "g")).toBe(5);
    expect(redondear(612, "g")).toBe(600);
  });

  it("rechaza una propuesta sin ingredientes o con cantidades absurdas", () => {
    const base = { grupo: "carne", minutosActivos: 20, ligero: false, pasos: "Se hace." };
    expect(propuestaPlatoSchema.safeParse({ ...base, ingredientes: [] }).success).toBe(false);
    expect(
      propuestaPlatoSchema.safeParse({ ...base, ingredientes: [ing("Pollo", 99999)] }).success,
    ).toBe(false);
    expect(
      propuestaPlatoSchema.safeParse({ ...base, ingredientes: [ing("Pollo", 150)] }).success,
    ).toBe(true);
  });
});
