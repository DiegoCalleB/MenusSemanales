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
    // Por defecto, el calendario de fechas (sin comidas); las comidas van en el suyo (D-140).
    expect(titulos(e)).toEqual(["🎉 Fiesta", "📌 Psicotécnico", "📌 Puente"]);
    const comidas = eventosSuscritos(
      base({
        cenas: [
          { fecha: "2026-11-09", nombre: "Sopa" },
          { fecha: "2026-11-09", nombre: "Pan" },
          { fecha: "2026-10-30", nombre: "Pasada" },
        ],
        almuerzos: [{ fecha: "2026-11-08", texto: "Paella" }],
        agenda: [{ fecha: "2026-11-12", hasta: null, hora: "18:15", titulo: "Psicotécnico" }],
      }),
      { hoy: HOY, para: "diego", solo: "comidas" },
    );
    expect(titulos(comidas)).toEqual(["🍽️ Cena: Sopa + Pan", "☀️ Comida: Paella"]);
    expect(e.find((x) => x.titulo === "📌 Psicotécnico")).toMatchObject({
      hora: "18:15",
      aviso: true,
    });
    expect(comidas.find((x) => x.titulo === "🍽️ Cena: Sopa + Pan")?.aviso).toBeUndefined();
    // Las comidas y cenas salen a su hora (D-135), sin alarma.
    // El 9 de noviembre de 2026 es lunes: se cena a las 20:00.
    expect(comidas.find((x) => x.titulo === "🍽️ Cena: Sopa + Pan")?.hora).toBe("20:00");
    expect(comidas.find((x) => x.titulo === "☀️ Comida: Paella")?.hora).toBe("14:00");
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
      { hoy: HOY, para: "diego", solo: "comidas" },
    );
    const hora = (n: string) => e.find((x) => x.titulo === `🍽️ Cena: ${n}`)?.hora;
    expect([hora("Viernes"), hora("Sábado"), hora("Domingo")]).toEqual(["20:00", "21:00", "21:00"]);
  });

  it("los cumpleaños salen el día del cumple con su tarta, sin avisos de regalo (D-143)", () => {
    const c = base({ cumples });
    for (const para of ["diego", "ana", null]) {
      const t = titulos(eventosSuscritos(c, { hoy: HOY, para }));
      expect(t).toEqual(expect.arrayContaining(["🎂 Cumple de Ana", "🎂 Cumple de Alba"]));
      expect(
        t.some((x) => x.startsWith("🎁")),
        String(para),
      ).toBe(false);
    }
    expect(
      eventosSuscritos(c, { hoy: HOY, para: "diego" }).find((x) => x.titulo === "🎂 Cumple de Ana"),
    ).toMatchObject({ fecha: "2026-11-07", aviso: true });
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

describe("qué llevar en el calendario (D-136)", () => {
  it("pone el recordatorio el día de prepararlo, a las 20:00 y con alarma", () => {
    // HOY (2026-11-02) es lunes: el piano del martes se prepara hoy; los patines, el jueves 5.
    const e = eventosSuscritos(
      base({
        personas: [...base().personas, { id: "emma", nombre: "Emma", tipo: "nino", activa: true }],
        mochila: [
          { personaId: "alba", texto: "Carpeta de piano", dias: [2], fecha: null, antes: 1 },
          { personaId: "emma", texto: "Patines", dias: [5], fecha: null, antes: 1 },
        ],
      }),
      { hoy: HOY, para: "diego" },
    ).filter((x) => x.titulo.startsWith("🎒"));
    expect(e.slice(0, 2)).toEqual([
      expect.objectContaining({
        fecha: "2026-11-02",
        titulo: "🎒 Preparar: Carpeta de piano de Alba (para mañana)",
        hora: "20:00",
        aviso: true,
      }),
      expect.objectContaining({
        fecha: "2026-11-05",
        titulo: "🎒 Preparar: Patines de Emma (para mañana)",
      }),
    ]);
    // 8 semanas × 2, menos las vísperas sin cole al día siguiente (D-144): el martes 8 de diciembre
    // (la Inmaculada) y el viernes 25 (Navidad).
    expect(e).toHaveLength(14);
    expect(e.some((x) => x.fecha === "2026-12-07" || x.fecha === "2026-12-24")).toBe(false);
  });

  it("lo que no es del cole se recuerda también los días sin cole", () => {
    const e = eventosSuscritos(
      base({
        mochila: [
          {
            personaId: "alba",
            texto: "Piano",
            dias: [2],
            fecha: null,
            antes: 1,
            soloConCole: false,
          },
        ],
      }),
      { hoy: HOY, para: "diego" },
    ).filter((x) => x.titulo.startsWith("🎒"));
    expect(e).toHaveLength(8);
  });

  it("sin «mochila» en el resumen (función SQL anterior) no rompe", () => {
    expect(proyeccionSchema.safeParse(base()).success).toBe(true);
  });
});

describe("días sin cole en el calendario (D-144)", () => {
  const conMochila = base({
    mochila: [{ personaId: "alba", texto: "Piano", dias: [2], fecha: null, antes: 1 }],
    diasCole: [{ fecha: "2026-11-24", hay: false, motivo: "Libre disposición" }],
  });

  it("salen de todo el día, sin alarma, juntando las vacaciones, solo en el de fechas", () => {
    const e = eventosSuscritos(conMochila, { hoy: HOY, para: "diego" }).filter((x) =>
      x.titulo.startsWith("🏫 Sin cole"),
    );
    expect(e.slice(0, 6)).toEqual([
      expect.objectContaining({ fecha: "2026-11-02", titulo: "🏫 Sin cole: Todos los Santos" }),
      { uid: "sin-cole-2026-11-09", fecha: "2026-11-09", hasta: null, titulo: "🏫 Sin cole: La Almudena (fiesta local)", descripcion: "No hay cole: La Almudena (fiesta local)." },
      expect.objectContaining({ fecha: "2026-11-24", titulo: "🏫 Sin cole: Libre disposición" }),
      expect.objectContaining({ fecha: "2026-12-07", hasta: null }),
      expect.objectContaining({ fecha: "2026-12-08", hasta: null }),
      expect.objectContaining({ fecha: "2026-12-23", hasta: "2027-01-06", titulo: "🏫 Sin cole: Vacaciones de Navidad" }),
    ]); // prettier-ignore
    expect(e.every((x) => !x.aviso && !x.hora)).toBe(true);
    expect(
      eventosSuscritos(conMochila, { hoy: HOY, para: "diego", solo: "comidas" }).some((x) =>
        x.titulo.includes("Sin cole"),
      ),
    ).toBe(false);
  });

  it("en un hogar sin nada del cole no salen", () => {
    expect(
      eventosSuscritos(base(), { hoy: HOY, para: "diego" }).some((x) =>
        x.titulo.includes("Sin cole"),
      ),
    ).toBe(false);
  });

  it("un resumen con días mal formados no rompe: se descartan", () => {
    const r = proyeccionSchema.safeParse({ ...base(), diasCole: [{ fecha: "mal", hay: "no" }] });
    expect(r.success).toBe(true);
    expect(r.success && r.data.diasCole).toEqual([]);
  });
});

describe("el menú del cole en el calendario de comidas (D-141)", () => {
  it("sale a las 13:00 con primero y segundo, solo en el de comidas", () => {
    const p = base({
      cole: [
        { fecha: "2026-11-01", primero: "Pasado", segundo: "Pasado", postre: null },
        { fecha: "2026-11-03", primero: "Lentejas", segundo: "Merluza", postre: "Fruta" },
        { fecha: "2026-11-04", primero: null, segundo: null, postre: null },
      ],
    });
    const comidas = eventosSuscritos(p, { hoy: HOY, para: "diego", solo: "comidas" });
    expect(comidas).toEqual([
      expect.objectContaining({
        uid: "cole-2026-11-03",
        titulo: "🏫 Cole: Lentejas · Merluza",
        descripcion: "Comida del cole: Lentejas, Merluza. Postre: Fruta",
        hora: "13:00",
      }),
    ]);
    expect(
      eventosSuscritos(p, { hoy: HOY, para: "diego" }).some((e) => e.titulo.startsWith("🏫 Cole")),
    ).toBe(false);
  });
});

describe("el tiempo en el calendario suscrito (D-154)", () => {
  const horas = Array.from({ length: 24 }, (_, hora) => ({
    hora,
    prob: hora === 9 ? 70 : 0,
    mm: hora === 9 ? 1 : 0,
    codigo: hora === 9 ? 61 : 2,
  }));
  // Jueves 19 de noviembre de 2026 (hay cole) y sábado 21.
  const tiempo = [
    { fecha: "2026-11-19", codigo: 61, max: 14, min: 9, probLluvia: 70, lluviaMm: 3, horas },
    { fecha: "2026-11-21", codigo: 61, max: 14, min: 3, probLluvia: 70, lluviaMm: 3, horas },
  ];
  const conMochila = base({
    mochila: [{ personaId: "diego", texto: "Flauta", dias: [1], fecha: null, antes: 1 }],
  });

  it("los días de cole, el paraguas con la hora; el resto, lo del día; de todo el día", () => {
    const e = eventosSuscritos(conMochila, { hoy: "2026-11-18", para: null, tiempo }).filter((x) =>
      x.uid?.startsWith("tiempo-"),
    );
    expect(e.map((x) => [x.uid, x.titulo, x.hora ?? null])).toEqual([
      [
        "tiempo-2026-11-19-paraguas",
        "🌂 Paraguas: llueve de camino al cole (de 8 a 9 h, 70 %)",
        null,
      ],
      ["tiempo-2026-11-21-lluvia", "🌧️ Lluvia (70 %): chubasquero y botas", null],
      ["tiempo-2026-11-21-frio", "🧣 Frío (mín. 3 °C): abrigo, gorro y guantes", null],
    ]);
  });

  it("sin previsión, o en el calendario de comidas, nada del tiempo", () => {
    const sin = eventosSuscritos(conMochila, { hoy: "2026-11-18", para: null });
    expect(sin.some((x) => x.uid?.startsWith("tiempo-"))).toBe(false);
    const comidas = eventosSuscritos(conMochila, {
      hoy: "2026-11-18",
      para: null,
      solo: "comidas",
      tiempo,
    });
    expect(comidas.some((x) => x.uid?.startsWith("tiempo-"))).toBe(false);
  });
});
