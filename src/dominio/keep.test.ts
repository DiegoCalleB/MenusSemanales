import { describe, expect, it } from "vitest";
import { leerListaDeKeep, pareceListaDeKeep, sinCasilla } from "./keep";

describe("listas de Keep (D-210)", () => {
  it("separa la casilla del texto, con los formatos que usa Keep", () => {
    expect(sinCasilla("☐ Leche")).toEqual({ marca: "pendiente", texto: "Leche" });
    expect(sinCasilla("  [ ] Huevos")).toEqual({ marca: "pendiente", texto: "Huevos" });
    expect(sinCasilla("☑ Pan")).toEqual({ marca: "marcada", texto: "Pan" });
    expect(sinCasilla("[x] Sal")).toEqual({ marca: "marcada", texto: "Sal" });
    expect(sinCasilla("[X] Sal")).toEqual({ marca: "marcada", texto: "Sal" });
    expect(sinCasilla("- ✓ Agua")).toEqual({ marca: "marcada", texto: "Agua" });
    expect(sinCasilla("Atún en aceite")).toEqual({ marca: "ninguna", texto: "Atún en aceite" });
  });

  it("solo importa lo que falta: lo marcado se ignora", () => {
    const l = leerListaDeKeep("☐ Leche\n☑ Pan\n☐ Huevos\n[x] Sal\nYogures\n\n");
    expect(l.pendientes).toEqual(["Leche", "Huevos", "Yogures"]);
    expect(l.marcadas).toEqual(["Pan", "Sal"]);
  });

  it("un grupo («MERCADONA») con cosas hundidas debajo no es un artículo", () => {
    const l = leerListaDeKeep(
      "☐ Recogedor terraza\n☐ MERCADONA\n    ☐ Pan de leche\n    ☐ Galletas choco\n    ☑ Mozzarella",
    );
    expect(l.pendientes).toEqual(["Recogedor terraza", "Pan de leche", "Galletas choco"]);
    expect(l.encabezados).toEqual(["MERCADONA"]);
    // Aunque el móvil no mande la sangría, un título en mayúsculas no se compra.
    expect(leerListaDeKeep("MERCADONA\nPan\nLeche").pendientes).toEqual(["Pan", "Leche"]);
    // Pero una sigla corta o con números sí es un artículo.
    expect(leerListaDeKeep("☐ TV\n☐ 7UP").pendientes).toEqual(["TV", "7UP"]);
  });

  it("no repite y recorta lo larguísimo", () => {
    const l = leerListaDeKeep(`☐ Leche\n☐ leche\n☐ Leche\n☐ ${"x".repeat(200)}`);
    expect(l.pendientes).toEqual(["Leche", "leche"]);
  });

  it("distingue una lista de un mensaje", () => {
    expect(pareceListaDeKeep("☐ Leche\n☑ Pan")).toBe(true);
    expect(pareceListaDeKeep("Pan\nLeche\nHuevos\nSal\nAgua")).toBe(true);
    expect(pareceListaDeKeep("Hola a todos")).toBe(false);
    expect(
      pareceListaDeKeep(
        "Buenos días familias, os recordamos que el viernes 20 hay excursión al museo y que deben llevar almuerzo en bolsa.\nGracias",
      ),
    ).toBe(false);
  });
});
