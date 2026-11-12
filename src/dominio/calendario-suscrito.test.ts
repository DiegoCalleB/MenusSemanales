import { describe, expect, it } from "vitest";
import { generarIcs } from "./compartir";
import {
  type ProyeccionCalendario,
  eventosSuscritos,
  proyeccionSchema,
} from "./calendario-suscrito";

const HOY = "2026-11-02";
const base = (extra: Partial<ProyeccionCalendario> = {}): ProyeccionCalendario => ({
  personas: [
    { id: "diego", nombre: "Diego", tipo: "adulto", activa: true },
    { id: "ana", nombre: "Ana", tipo: "adulto", activa: true },
    { id: "alba", nombre: "Alba", tipo: "nino", activa: true },
  ],
  cenas: [],
  almuerzos: [],
  eventos: {},
  agenda: [],
  casa: [],
  cumples: [],
  ...extra,
});
const cumples = [
  { nombre: "Ana", dia: 7, mes: 11, anio: 1984, personaId: "ana" },
  { nombre: "Alba", dia: 4, mes: 2, anio: 2017, personaId: "alba" },
];
const titulos = (e: ReturnType<typeof eventosSuscritos>) => e.map((x) => x.titulo);

describe("calendario suscrito", () => {
  it("lleva cenas, comidas, fechas señaladas y apuntes futuros, con alarma en los apuntes", () => {
    const e = eventosSuscritos(
      base({
        cenas: [
          { fecha: "2026-11-09", nombre: "Sopa" },
          { fecha: "2026-11-09", nombre: "Pan" },
          { fecha: "2026-10-30", nombre: "Pasada" },
        ],
        almuerzos: [{ fecha: "2026-11-08", texto: "Paella" }],
        eventos: {
          "2026-11-20": { titulo: "Fiesta", emoji: "🎉" },
          "2026-10-01": { titulo: "Vieja", emoji: "x" },
        },
        agenda: [
          { fecha: "2026-11-12", hasta: null, hora: "18:15", titulo: "Psicotécnico" },
          { fecha: "2026-10-01", hasta: "2026-10-03", titulo: "Pasado", hora: null },
          { fecha: "2026-10-30", hasta: "2026-11-03", titulo: "Puente", hora: null },
        ],
      }),
      { hoy: HOY, para: "diego" },
    );
    expect(titulos(e)).toEqual([
      "🍽️ Cena: Sopa + Pan",
      "☀️ Comida: Paella",
      "🎉 Fiesta",
      "📌 Psicotécnico",
      "📌 Puente",
    ]);
    expect(e.find((x) => x.titulo === "📌 Psicotécnico")).toMatchObject({
      hora: "18:15",
      aviso: true,
    });
    expect(e.find((x) => x.titulo === "🍽️ Cena: Sopa + Pan")?.aviso).toBeUndefined();
    // Las comidas y cenas salen a su hora (D-135), sin alarma.
    // El 9 de noviembre de 2026 es lunes: se cena a las 20:00.
    expect(e.find((x) => x.titulo === "🍽️ Cena: Sopa + Pan")?.hora).toBe("20:00");
    expect(e.find((x) => x.titulo === "☀️ Comida: Paella")?.hora).toBe("14:00");
  });

  it("la cena es a las 21:00 en fin de semana y a las 20:00 entre semana", () => {
    const e = eventosSuscritos(
      base({
        cenas: [
          { fecha: "2026-11-13", nombre: "Viernes" },
          { fecha: "2026-11-14", nombre: "Sábado" },
          { fecha: "2026-11-15", nombre: "Domingo" },
        ],
      }),
      { hoy: HOY, para: "diego" },
    );
    const hora = (n: string) => e.find((x) => x.titulo === `🍽️ Cena: ${n}`)?.hora;
    expect([hora("Viernes"), hora("Sábado"), hora("Domingo")]).toEqual(["20:00", "21:00", "21:00"]);
  });

  it("los cumpleaños salen siempre; los avisos del regalo, solo a quien no cumple", () => {
    const c = base({ cumples });
    const paraDiego = eventosSuscritos(c, { hoy: HOY, para: "diego" });
    expect(titulos(paraDiego)).toEqual(
      expect.arrayContaining([
        "🎂 Cumple de Ana",
        "🎁 Pensar el regalo de Ana",
        "🎁 Comprar el regalo de Ana",
        "🎂 Cumple de Alba",
      ]),
    );
    expect(paraDiego.find((x) => x.titulo === "🎂 Cumple de Ana")).toMatchObject({
      fecha: "2026-11-07",
      anual: true,
      aviso: true,
    });
    // A Ana no le llegan los avisos de su propio regalo (pero sí los del de Alba).
    const paraAna = titulos(eventosSuscritos(c, { hoy: HOY, para: "ana" }));
    expect(paraAna).toContain("🎂 Cumple de Ana");
    expect(paraAna).not.toContain("🎁 Pensar el regalo de Ana");
    expect(paraAna).not.toContain("🎁 Comprar el regalo de Ana");
    expect(paraAna).toContain("🎁 Pensar el regalo de Alba");
    // Sin saber quién pide, o una niña, o alguien que no existe: ningún aviso de regalo.
    for (const para of [null, "alba", "nadie"]) {
      expect(
        titulos(eventosSuscritos(c, { hoy: HOY, para })).some((t) => t.startsWith("🎁")),
        String(para),
      ).toBe(false);
    }
  });

  it("las tareas de casa van en el día que toca (hoy si están atrasadas) y a quien le tocan", () => {
    const t = (titulo: string, resp: string | null, extra = {}) => ({
      titulo,
      emoji: "🏠",
      cadaDias: 14,
      responsableId: resp,
      ultimaVez: null,
      desde: "2026-11-10",
      aplazadaHasta: null,
      ...extra,
    });
    const p = base({
      casa: [
        t("Sábanas", "diego"),
        t("Areneros", null, { desde: "2026-10-01" }),
        t("Toallas", "ana"),
        t("Hecha", "diego", { ultimaVez: "2026-11-01" }),
      ],
    });
    const diego = eventosSuscritos(p, { hoy: HOY, para: "diego" });
    expect(titulos(diego)).toEqual(["🏠 Sábanas", "🏠 Areneros", "🏠 Hecha"]);
    expect(diego.find((x) => x.titulo === "🏠 Areneros")?.fecha).toBe(HOY); // atrasada → hoy
    expect(diego.find((x) => x.titulo === "🏠 Sábanas")).toMatchObject({
      fecha: "2026-11-10",
      aviso: true,
    });
    expect(diego.find((x) => x.titulo === "🏠 Hecha")?.fecha).toBe("2026-11-15"); // 1/11 + 14
    expect(titulos(eventosSuscritos(p, { hoy: HOY, para: "ana" }))).toEqual([
      "🏠 Areneros",
      "🏠 Toallas",
    ]);
    // Sin persona: todas.
    expect(eventosSuscritos(p, { hoy: HOY, para: null })).toHaveLength(4);
  });

  it("los identificadores son estables (el calendario actualiza en vez de duplicar) y no se repiten", () => {
    const p = base({
      cumples,
      casa: [
        {
          titulo: "Sábanas",
          emoji: "🛏️",
          cadaDias: 7,
          responsableId: null,
          ultimaVez: null,
          desde: HOY,
        },
      ],
      agenda: [{ fecha: "2026-11-12", hasta: null, hora: null, titulo: "Cita médica!" }],
    });
    const a = eventosSuscritos(p, { hoy: HOY, para: "diego" });
    const b = eventosSuscritos(p, { hoy: HOY, para: "diego" });
    expect(a.map((x) => x.uid)).toEqual(b.map((x) => x.uid));
    expect(new Set(a.map((x) => x.uid)).size).toBe(a.length);
    expect(a.map((x) => x.uid)).toContain("casa-sabanas");
    expect(a.map((x) => x.uid)).toContain("agenda-2026-11-12-cita-medica");
    // Si la tarea cambia de día, es el mismo evento (mismo uid).
    const movida = eventosSuscritos(
      base({
        casa: [
          {
            titulo: "Sábanas",
            emoji: "🛏️",
            cadaDias: 7,
            responsableId: null,
            ultimaVez: HOY,
            desde: HOY,
          },
        ],
      }),
      { hoy: HOY, para: null },
    );
    expect(movida[0]?.uid).toBe("casa-sabanas");
    expect(movida[0]?.fecha).toBe("2026-11-09");
  });

  it("el archivo lleva alarmas, el refresco y los identificadores", () => {
    const e = eventosSuscritos(
      base({
        agenda: [{ fecha: "2026-11-12", hasta: null, hora: "18:15", titulo: "Psico" }],
        casa: [
          {
            titulo: "Sábanas",
            emoji: "🛏️",
            cadaDias: 7,
            responsableId: null,
            ultimaVez: null,
            desde: HOY,
          },
        ],
      }),
      { hoy: HOY, para: "diego" },
    );
    const ics = generarIcs("Casa", e, new Date("2026-11-02T08:00:00Z"), 1);
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(ics).toContain("X-PUBLISHED-TTL:PT1H");
    expect(ics).toContain("UID:casa-sabanas@menus-semanales");
    expect(ics).toContain("TRIGGER:PT9H"); // la tarea, de todo el día: 9:00
    expect(ics).toContain("TRIGGER:-PT1H"); // la cita, con hora: una hora antes
    expect(generarIcs("x", e, new Date())).not.toContain("REFRESH-INTERVAL");
  });
});

describe("el resumen que llega de la base de datos", () => {
  it("se valida: lo mal formado se rechaza, lo de más se ignora", () => {
    expect(proyeccionSchema.safeParse(base()).success).toBe(true);
    expect(
      proyeccionSchema.safeParse({ ...base(), cenas: [{ fecha: "mañana", nombre: "x" }] }).success,
    ).toBe(false);
    expect(proyeccionSchema.safeParse({ ...base(), personas: "no" }).success).toBe(false);
    const conExtra = proyeccionSchema.parse({ ...base(), ideas: ["secreto"] });
    expect(JSON.stringify(conExtra)).not.toContain("secreto");
    expect(
      proyeccionSchema.safeParse({
        ...base(),
        agenda: [{ fecha: HOY, hasta: null, hora: "9", titulo: "x" }],
      }).success,
    ).toBe(false);
  });
});
