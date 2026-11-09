import { describe, expect, it } from "vitest";
import { coincideConBusqueda, ordenarPorBusqueda } from "./texto";

describe("buscar platos mientras se escribe", () => {
  it("encaja sin tildes ni mayúsculas y en cualquier orden", () => {
    expect(coincideConBusqueda("Milanesa de pollo", "milanesa pollo")).toBe(true);
    expect(coincideConBusqueda("Milanesa de pollo", "POLLO milanesa")).toBe(true);
    expect(coincideConBusqueda("Crema de calabacín", "calabacin")).toBe(true);
    expect(coincideConBusqueda("Milanesa de pollo", "pescado")).toBe(false);
    expect(coincideConBusqueda("Milanesa de pollo", "milanesa pescado")).toBe(false);
  });

  it("con la consulta vacía encaja todo", () => {
    expect(coincideConBusqueda("Lo que sea", "")).toBe(true);
    expect(coincideConBusqueda("Lo que sea", "   ")).toBe(true);
  });

  it("pone primero lo que empieza por lo escrito y luego por orden alfabético", () => {
    const platos = ["Pollo al curry", "Arroz con pollo", "Pollo asado", "Albóndigas de pollo"];
    expect(ordenarPorBusqueda(platos, (p) => p, "pollo")).toEqual([
      "Pollo al curry",
      "Pollo asado",
      "Albóndigas de pollo",
      "Arroz con pollo",
    ]);
  });
});
