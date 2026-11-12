import { describe, expect, it } from "vitest";
import { textoCompartido } from "./vistas/compartido-vista";

describe("texto compartido (D-138)", () => {
  it("junta título, texto y enlace sin repetir", () => {
    expect(textoCompartido({ title: "AMPA", text: "Reunión el 18 a las 16:00" })).toBe(
      "AMPA\nReunión el 18 a las 16:00",
    );
    expect(textoCompartido({ text: "Mira https://x.es", url: "https://x.es" })).toBe(
      "Mira https://x.es",
    );
    expect(textoCompartido({})).toBe("");
  });
});
