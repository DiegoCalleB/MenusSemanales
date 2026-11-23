import { describe, expect, it } from "vitest";
import { PILARES, pestanaActiva, pilarDe, pilaresPara } from "./pilares";

describe("pilares de la app", () => {
  it("son cinco, con la portada primero y «Más» al final", () => {
    expect(PILARES.map((p) => p.texto)).toEqual(["Hoy", "Comer", "Casa", "Fechas", "Más"]);
  });

  it("cada pantalla que ya existía pertenece a un pilar (nada queda huérfano)", () => {
    const rutas: Record<string, string> = {
      "/": "hoy",
      "/menu": "comer",
      "/menu/cole": "comer",
      "/menu/emergencia": "comer",
      "/menu/platos": "comer",
      "/compra": "comer",
      "/despensa": "comer",
      "/casa": "casa",
      "/tareas": "casa",
      "/reparto": "casa",
      "/fechas": "fechas",
      "/calendario": "fechas",
      "/cumples": "fechas",
      "/medicacion": "casa",
      "/barrio": "fechas",
      "/papeles": "fechas",
      "/cuenta": "mas",
      "/compartir": "mas",
      "/personas": "mas",
      "/objetivos": "mas",
      "/yo": "mas",
      "/notas": "mas",
      "/avisos": "mas",
    };
    for (const [ruta, pilar] of Object.entries(rutas)) expect(pilarDe(ruta)?.id, ruta).toBe(pilar);
    expect(pilarDe("/no-existe")).toBeNull();
  });

  it("«Llego tarde» ya no es pestaña, pero sigue siendo de Comer", () => {
    const comer = PILARES.find((p) => p.id === "comer");
    expect(comer?.pestanas.some((t) => t.href === "/menu/emergencia")).toBe(false);
    expect(pilarDe("/menu/emergencia")?.id).toBe("comer");
  });

  it("el botón de cada pilar lleva a una de sus propias pestañas", () => {
    for (const p of PILARES.filter((x) => x.pestanas.length > 0)) {
      expect(
        p.pestanas.map((t) => t.href),
        p.id,
      ).toContain(p.href);
    }
  });

  it("la pestaña abierta es la más específica: /menu/cole no enciende «Cena»", () => {
    const comer = PILARES.find((p) => p.id === "comer")!;
    expect(pestanaActiva(comer, "/menu")?.texto).toBe("Cena");
    expect(pestanaActiva(comer, "/menu/cole")?.texto).toBe("Cole");
    expect(pestanaActiva(comer, "/menu/platos")?.texto).toBe("Platos");
    expect(pestanaActiva(comer, "/despensa")?.texto).toBe("Despensa");
    expect(pestanaActiva(comer, "/casa")).toBeNull();
  });
  it("lo personal cuelga de «Yo», y cada uno ve sus pestañas (D-206)", () => {
    const mas = PILARES.find((p) => p.id === "mas")!;
    for (const r of ["/objetivos", "/notas", "/avisos", "/yo"]) {
      expect(pilarDe(r)?.id, r).toBe("mas");
      expect(pestanaActiva(mas, r)?.href, r).toBe("/yo");
    }
    const familia = pilaresPara("familia", false);
    const textos = (ps: typeof familia) => ps.flatMap((p) => p.pestanas.map((t) => t.href));
    expect(textos(familia)).not.toContain("/yo");
    expect(textos(familia)).not.toContain("/barrio");
    expect(textos(familia)).not.toContain("/reparto");
    expect(textos(pilaresPara("completo", true))).toEqual(
      expect.arrayContaining(["/yo", "/barrio", "/reparto"]),
    );
    // Una pestaña escondida sigue siendo de su pilar (por si se llega por enlace).
    expect(pilarDe("/barrio", familia)?.id).toBe("fechas");
  });
});
