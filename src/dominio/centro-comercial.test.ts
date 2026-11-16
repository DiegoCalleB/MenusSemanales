import { describe, expect, it } from "vitest";
import {
  entradasDelCentro,
  esLasRosas,
  planesDelCentro,
  respuestaCentroSchema,
} from "./centro-comercial";

const wp = (id: number, date: string, titulo: string, html: string) => ({
  id,
  date,
  link: `https://www.cclasrosas.es/eventos/e${id}/`,
  title: { rendered: titulo },
  content: { rendered: html },
});

describe("Centro Comercial Las Rosas (D-172)", () => {
  const entradas = entradasDelCentro([
    wp(
      10,
      "2026-10-19T13:53:09",
      "Misterio en Las Rosas",
      "<p>Los d&iacute;as <strong>6, 7 y 8</strong></p>&nbsp;<script>x()</script>",
    ),
    wp(11, "2026-09-25T12:26:14", "Cuéntame un cuento", "<p>Teatro de títeres</p>"),
    { id: "mal" },
  ]);

  it("limpia el HTML y se queda con las entradas de su web", () => {
    expect(entradas).toHaveLength(2);
    expect(entradas[0]?.texto).toContain("6, 7 y 8");
    expect(entradas[0]?.texto).not.toContain("x()");
    expect(entradas[0]?.enlace).toBe("https://www.cclasrosas.es/eventos/e10/");
    expect(
      entradasDelCentro([
        { ...wp(1, "2026-10-01T00:00:00", "x", "y"), link: "https://otra.web/x/" },
      ]),
    ).toEqual([]);
  });

  it("de lo que lee la IA salen planes solo con días razonables y de entradas que existen", () => {
    const leidos = respuestaCentroSchema.parse({
      eventos: [
        {
          entradaId: 10,
          titulo: "Misterio en Las Rosas",
          fechas: ["2026-11-06", "2026-11-07", "2026-10-31", "2030-01-01"],
          hora: "18:00",
          gratis: true,
          familiar: true,
          tipo: "juego",
        },
        {
          entradaId: 999,
          titulo: "Inventado",
          fechas: ["2026-11-20"],
          hora: null,
          gratis: true,
          familiar: true,
          tipo: "otro",
        },
      ],
    });
    const p = planesDelCentro(leidos, entradas, "2026-11-04");
    expect(p.map((x) => x.fecha)).toEqual(["2026-11-06", "2026-11-07"]);
    expect(p[0]).toMatchObject({
      titulo: "Misterio en Las Rosas",
      hora: "18:00",
      lugar: "C.C. Las Rosas",
      emoji: "🎲",
      familiar: true,
      serie: false,
      enlace: "https://www.cclasrosas.es/eventos/e10/",
    });
    expect(esLasRosas(p[0]!.lugar)).toBe(true);
  });

  it("una respuesta mal formada no pasa; un dato suelto raro se corrige", () => {
    expect(respuestaCentroSchema.safeParse({ eventos: [{ entradaId: 1 }] }).success).toBe(false);
    const r = respuestaCentroSchema.parse({
      eventos: [
        {
          entradaId: 1,
          titulo: "x",
          fechas: ["2026-11-06"],
          hora: "25:99",
          gratis: "sí",
          familiar: 3,
          tipo: "baile",
        },
      ],
    });
    expect(r.eventos[0]).toMatchObject({ hora: null, gratis: true, familiar: false, tipo: "otro" });
  });
});
