import { describe, expect, it } from "vitest";
import type { Pendiente } from "./pendientes";
import { esIdDeTodoist, planDeSincronizacion, textoDePendiente } from "./todoist";

const p = (id: string, over: Partial<Pendiente> = {}): Pendiente => ({
  id,
  texto: id,
  personaId: null,
  importante: false,
  creadoEn: "2026-11-01",
  hechoEn: null,
  ...over,
});

describe("Todoist (D-205): qué se manda", () => {
  it("crea lo abierto que aún no tiene tarea (de Diego o de nadie) y cierra lo hecho aquí o quitado", () => {
    const r = planDeSincronizacion(
      [
        p("a"),
        p("b", { personaId: "diego" }),
        p("c", { personaId: "ana" }),
        p("d", { todoistId: "T1" }),
        p("e", { todoistId: "T2", hechoEn: "2026-11-02" }),
        p("f", { hechoEn: "2026-11-02" }),
        p("g", { todoistId: "T3", personaId: "ana", hechoEn: "2026-11-02" }),
      ],
      ["T9", "mal id!"],
      "diego",
    );
    expect(r.crear).toEqual([
      { ref: "a", content: "a" },
      { ref: "b", content: "b" },
    ]);
    expect(r.cerrar.sort()).toEqual(["T2", "T9"]);
  });
  it("valida los ids y acorta los textos largos", () => {
    expect(esIdDeTodoist("6XGgmFVcrG5RRjVr")).toBe(true);
    expect(esIdDeTodoist("../x")).toBe(false);
    expect(esIdDeTodoist(12)).toBe(false);
    expect(textoDePendiente("  hola   mundo ")).toBe("hola mundo");
    expect(textoDePendiente("x".repeat(300))).toHaveLength(120);
  });
});
