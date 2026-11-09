import { describe, expect, it } from "vitest";
import { menuDeComidaEnCasa } from "./almuerzos";

describe("menuDeComidaEnCasa (D-128)", () => {
  it("una milanesa de pollo hace de segundo plato", () => {
    const m = menuDeComidaEnCasa([{ grupo: "carne", nombre: "Milanesa de pollo" }]);
    expect(m).toMatchObject({
      primero: null,
      segundo: "carne",
      textoSegundo: "Milanesa de pollo",
      origen: "casa",
    });
  });

  it("una pasta de primero y un pescado de segundo", () => {
    const m = menuDeComidaEnCasa([
      { grupo: "pasta", nombre: "Macarrones" },
      { grupo: "pescado", nombre: "Merluza" },
    ]);
    expect(m).toMatchObject({ primero: "pasta", segundo: "pescado" });
  });

  it("sin plato con grupo que cuente no hay menú", () => {
    expect(menuDeComidaEnCasa([])).toBeNull();
    expect(menuDeComidaEnCasa([{ grupo: "otro", nombre: "Tapas" }])).toBeNull();
  });
});
