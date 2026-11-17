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
    expect(titulos(comidas)).toEqual(["🍽️ Sopa + Pan", "☀️ Paella"]);
    expect(e.find((x) => x.titulo === "📌 Psicotécnico")).toMatchObject({
      hora: "18:15",
      aviso: true,
    });
    expect(comidas.find((x) => x.titulo === "🍽️ Sopa + Pan")?.aviso).toBeUndefined();
    // Las comidas y cenas salen a su hora (D-135), sin alarma.
    // El 9 de noviembre de 2026 es lunes: se cena a las 20:00.
    expect(comidas.find((x) => x.titulo === "🍽️ Sopa + Pan")?.hora).toBe("20:00");
    expect(comidas.find((x) => x.titulo === "☀️ Paella")?.hora).toBe("14:00");
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
    const hora = (n: string) => e.find((x) => x.titulo === `🍽️ ${n}`)?.hora;
    expect([hora("Viernes"), hora("Sábado"), hora("Domingo")]).toEqual(["20:00", "21:00", "21:00"]);
  });

  it("los cumpleaños salen el día del cumple con su tarta, sin avisos de regalo (D-143)", () => {
    const c = base({ cumples });
    for (const para of ["diego", "ana", null]) {
      const t = titulos(eventosSuscritos(c, { hoy: HOY, para }));
      expect(t).toEqual(expect.arrayContaining(["🎂 Ana", "🎂 Alba"]));
      expect(
        t.some((x) => x.startsWith("🎁")),
        String(para),
      ).toBe(false);
    }
    expect(
      eventosSuscritos(c, { hoy: HOY, para: "diego" }).find((x) => x.titulo === "🎂 Ana"),
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
        titulo: "🎒 Carpeta de piano · Alba",
        hora: "20:00",
        aviso: true,
      }),
      expect.objectContaining({
        fecha: "2026-11-05",
        titulo: "🎒 Patines · Emma",
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

  it("salen de todo el día, sin alarma, y los periodos largos solo con inicio y fin (D-162)", () => {
    const e = eventosSuscritos(conMochila, { hoy: HOY, para: "diego" }).filter(
      (x) => x.titulo.startsWith("🏫 Sin cole") || /^🏫 (Inicio|Fin) /.test(x.titulo),
    );
    expect(e.slice(0, 6)).toEqual([
      expect.objectContaining({ fecha: "2026-11-02", titulo: "🏫 Sin cole: Todos los Santos" }),
      { uid: "sin-cole-2026-11-09", fecha: "2026-11-09", hasta: null, titulo: "🏫 Sin cole: La Almudena", descripcion: "No hay cole: La Almudena (fiesta local)." },
      expect.objectContaining({ fecha: "2026-11-24", titulo: "🏫 Sin cole: Libre disposición" }),
      expect.objectContaining({ fecha: "2026-12-07", hasta: null }),
      expect.objectContaining({ fecha: "2026-12-08", hasta: null }),
      expect.objectContaining({ uid: "sin-cole-inicio-2026-12-23", fecha: "2026-12-23", titulo: "🏫 Inicio vacaciones de Navidad" }),
    ]); // prettier-ignore
    // Navidad no es un evento de quince días: el fin va aparte, el último día sin cole.
    expect(e.find((x) => x.uid === "sin-cole-fin-2027-01-06")).toMatchObject({
      fecha: "2027-01-06",
      titulo: "🏫 Fin vacaciones de Navidad",
      descripcion: "Último día sin cole. El cole vuelve el lunes 11 de enero.",
    });
    expect(e.some((x) => x.hasta && x.titulo.includes("Navidad"))).toBe(false);
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
        titulo: "🏫 Lentejas · Merluza",
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
      ["tiempo-2026-11-19-paraguas", "🌂 Paraguas 8–9 h", null],
      ["tiempo-2026-11-21-lluvia", "🌧️ Lluvia (70 %)", null],
      ["tiempo-2026-11-21-frio", "🧣 Frío (mín. 3 °C)", null],
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

describe("el estadio en el calendario suscrito (D-159)", () => {
  const estadio = [
    {
      id: "partido-2",
      fecha: "2026-12-06",
      hora: "21:00",
      tipo: "partido" as const,
      titulo: "Atlético – Real Betis (Liga)",
    },
    {
      id: "partido-3",
      fecha: "2026-12-13",
      hora: null,
      tipo: "partido" as const,
      titulo: "Atlético – Valencia (Liga)",
    },
  ];

  it("los partidos van en su propio calendario, con su hora si está confirmada (D-163)", () => {
    const e = eventosSuscritos(base(), { hoy: HOY, para: null, solo: "metropolitano", estadio });
    expect(e.map((x) => [x.uid, x.titulo, x.hora])).toEqual([
      ["estadio-partido-2", "⚽ Atlético – Real Betis", "21:00"],
      ["estadio-partido-3", "⚽ Atlético – Valencia", null],
    ]);
    // Ni en el de fechas ni en el de comidas.
    for (const solo of ["fechas", "comidas"] as const) {
      expect(
        eventosSuscritos(base(), { hoy: HOY, para: null, solo, estadio }).some((x) =>
          x.uid?.startsWith("estadio-"),
        ),
      ).toBe(false);
    }
  });

  it("si ese día hay algo más apuntado, un aviso ⚠️ con alarma en el calendario de fechas", () => {
    const p = base({
      agenda: [
        { fecha: "2026-12-06", hasta: null, hora: "18:00", titulo: "Comida en casa de la abuela" },
      ],
      cumples: [{ nombre: "Leo", dia: 13, mes: 12, anio: null, personaId: null }],
    });
    const choques = eventosSuscritos(p, { hoy: HOY, para: null, estadio }).filter((x) =>
      x.uid?.startsWith("choque-"),
    );
    expect(choques.map((x) => [x.uid, x.fecha, x.titulo, x.aviso])).toEqual([
      ["choque-partido-2", "2026-12-06", "⚠️ Partido y Comida en casa de la abuela", true],
      ["choque-partido-3", "2026-12-13", "⚠️ Partido y Cumple de Leo", true],
    ]);
    expect(choques[0]?.descripcion).toContain("también: Comida en casa de la abuela");
    // El aviso de choque no va en el calendario del estadio.
    expect(
      eventosSuscritos(p, { hoy: HOY, para: null, solo: "metropolitano", estadio }).some((x) =>
        x.uid?.startsWith("choque-"),
      ),
    ).toBe(false);
    // Sin nada más ese día, no hay aviso.
    expect(
      eventosSuscritos(base(), { hoy: HOY, para: null, estadio }).some((x) =>
        x.uid?.startsWith("choque-"),
      ),
    ).toBe(false);
  });
});

describe("títulos cortos en el calendario (D-161)", () => {
  it("«Sin cole» a secas si el motivo no dice nada, y el motivo sin relleno si lo dice", () => {
    const e = eventosSuscritos(
      base({
        mochila: [{ personaId: "diego", texto: "Flauta", dias: [1], fecha: null, antes: 1 }],
        diasCole: [
          { fecha: "2026-11-04", hay: false, motivo: "Día no lectivo" },
          { fecha: "2026-11-05", hay: false, motivo: "Día de la Constitución" },
        ],
      }),
      { hoy: HOY, para: null },
    ).filter((x) => x.uid?.startsWith("sin-cole-"));
    expect(e.map((x) => x.titulo)).toEqual(
      expect.arrayContaining(["🏫 Sin cole", "🏫 Sin cole: Constitución"]),
    );
  });

  it("el paraguas de ida y vuelta, en un título corto; el detalle, en la descripción", () => {
    const horas = Array.from({ length: 24 }, (_, hora) => ({
      hora,
      prob: [9, 15].includes(hora) ? 70 : 0,
      mm: [9, 15].includes(hora) ? 1 : 0,
      codigo: [9, 15].includes(hora) ? 61 : 2,
    }));
    const e = eventosSuscritos(
      base({
        mochila: [{ personaId: "diego", texto: "Flauta", dias: [1], fecha: null, antes: 1 }],
      }),
      {
        hoy: "2026-11-18",
        para: null,
        tiempo: [
          { fecha: "2026-11-19", codigo: 61, max: 14, min: 9, probLluvia: 70, lluviaMm: 3, horas },
        ],
      },
    ).find((x) => x.uid === "tiempo-2026-11-19-paraguas");
    expect(e?.titulo).toBe("🌂 Paraguas 8–9 y 14–15 h");
    expect(e?.descripcion).toContain("llueve de camino al cole (de 8 a 9 h, 70 %)");
  });

  it("el verano es un inicio y un fin, no un evento por día; sin curso conocido, sin fin", () => {
    const conCole = base({
      mochila: [{ personaId: "diego", texto: "Flauta", dias: [1], fecha: null, antes: 1 }],
    });
    const verano = (hoy: string) =>
      eventosSuscritos(conCole, { hoy, para: null })
        .filter((x) => /verano/i.test(x.titulo))
        .map((x) => [x.fecha, x.titulo]);
    // Si hoy ya estamos de vacaciones, el inicio no se inventa para hoy.
    expect(verano("2026-07-15").map((x) => x[1])).toEqual(["🏫 Fin vacaciones de verano"]);
    // El verano de 2027 empieza (se conoce) pero aún no se sabe cuándo acaba: sin «fin».
    expect(verano("2027-06-01")).toEqual([["2027-06-21", "🏫 Inicio vacaciones de verano"]]);
    // Y entonces tampoco se da una fecha de fin inventada en la descripción.
    const inicio2027 = eventosSuscritos(
      base({
        mochila: [{ personaId: "diego", texto: "Flauta", dias: [1], fecha: null, antes: 1 }],
      }),
      { hoy: "2027-06-01", para: null },
    ).find((x) => x.uid === "sin-cole-inicio-2027-06-21");
    expect(inicio2027?.descripcion).toBe("Empieza vacaciones de verano.");
  });
});

describe("los planes del barrio en el calendario suscrito (D-165)", () => {
  const barrio = [
    {
      id: "1",
      fecha: "2026-11-19",
      hasta: null,
      hora: "18:00",
      titulo: "'Otoño de cuentos' con Alicia Cuenteando",
      lugar: "Biblioteca Pública Municipal Canillejas",
      barrio: "Canillejas",
      gratis: true,
      precio: null,
      enlace: "http://www.madrid.es/cuentos",
      familiar: true,
      serie: false,
      emoji: "🧸",
    },
    {
      id: "2",
      fecha: "2026-11-20",
      hasta: "2026-11-22",
      hora: null,
      titulo: "VI Festival De Raíz Flamenca",
      lugar: "Centro Cultural Antonio Machado",
      barrio: "Arcos",
      gratis: true,
      precio: null,
      enlace: null,
      familiar: false,
      serie: false,
      emoji: "💃",
    },
  ];

  it("en su propio calendario, con emoji, hora o todo el día, y el detalle en la descripción", () => {
    const e = eventosSuscritos(base(), { hoy: HOY, para: null, solo: "barrio", barrio });
    expect(e.map((x) => [x.uid, x.titulo, x.hora ?? null, x.hasta ?? null])).toEqual([
      ["barrio-1-2026-11-19", "🧸 'Otoño de cuentos' con Alicia Cuenteando", "18:00", null],
      ["barrio-2-2026-11-20", "💃 VI Festival De Raíz Flamenca", null, "2026-11-22"],
    ]);
    expect(e[0]?.descripcion).toContain(
      "Biblioteca Pública Municipal Canillejas, barrio de Canillejas",
    );
    expect(e[0]?.descripcion).toContain("Gratis.");
    expect(e[0]?.descripcion).toContain("Para ir en familia.");
    // Ni en el de fechas, ni en el de comidas, ni en el del estadio.
    for (const solo of ["fechas", "comidas", "metropolitano"] as const) {
      expect(
        eventosSuscritos(base(), { hoy: HOY, para: null, solo, barrio }).some((x) =>
          x.uid?.startsWith("barrio-"),
        ),
      ).toBe(false);
    }
  });
});

describe("los papeles y vencimientos en el calendario suscrito (D-174)", () => {
  const venc = (o: object = {}) => ({
    titulo: "ITV del coche",
    categoria: "coche",
    personaId: null,
    fecha: "2026-12-04",
    avisos: [30, 7],
    hechoEn: null,
    ...o,
  });
  it("salen el día en que vencen, de todo el día y con aviso, con de quién son", () => {
    const e = eventosSuscritos(
      base({
        vencimientos: [
          venc(),
          venc({ titulo: "Pasaporte", personaId: "alba", fecha: "2027-01-10" }),
        ],
      }),
      { hoy: HOY, para: null },
    );
    const papeles = e.filter((x) => x.uid?.startsWith("papel-"));
    expect(papeles.map((x) => [x.titulo, x.fecha])).toEqual([
      ["📄 ITV del coche", "2026-12-04"],
      ["📄 Pasaporte · Alba", "2027-01-10"],
    ]);
    expect(papeles[0]).toMatchObject({ aviso: true });
    expect(papeles[0]?.hora ?? null).toBeNull();
  });
  it("no salen los hechos ni los vencidos hace más de un mes; sí los de hace poco", () => {
    const e = eventosSuscritos(
      base({
        vencimientos: [
          venc({ titulo: "Hecho", hechoEn: "2026-10-01" }),
          venc({ titulo: "Muy viejo", fecha: "2026-09-01" }),
          venc({ titulo: "Reciente", fecha: "2026-10-20" }),
        ],
      }),
      { hoy: HOY, para: null },
    );
    expect(titulos(e.filter((x) => x.uid?.startsWith("papel-")))).toEqual(["📄 Reciente"]);
  });
  it("no mezclan con las comidas ni el estadio: van en el calendario principal", () => {
    const todos = eventosSuscritos(base({ vencimientos: [venc()] }), { hoy: HOY, para: null });
    expect(todos.some((x) => x.uid?.startsWith("papel-"))).toBe(true);
    expect(
      eventosSuscritos(base({ vencimientos: [venc()] }), {
        hoy: HOY,
        para: null,
        solo: "comidas",
      }).some((x) => x.uid?.startsWith("papel-")),
    ).toBe(false);
  });
  it("el resumen sin vencimientos (la base de datos antigua) sigue valiendo", () => {
    expect(proyeccionSchema.safeParse(base()).success).toBe(true);
    expect(proyeccionSchema.parse({ ...base(), vencimientos: "mal" }).vencimientos).toEqual([]);
  });
});

describe("el resumen con pendientes sin fecha (D-175)", () => {
  it("se valida y lo de más se ignora; sin ellos (base antigua) sigue valiendo", () => {
    const ok = proyeccionSchema.parse({
      ...base(),
      pendientes: [
        {
          texto: "Llamar",
          personaId: null,
          importante: true,
          creadoEn: HOY,
          hechoEn: null,
          extra: "x",
        },
      ],
    });
    expect(ok.pendientes).toHaveLength(1);
    expect(JSON.stringify(ok)).not.toContain('"extra"');
    expect(proyeccionSchema.parse({ ...base(), pendientes: "mal" }).pendientes).toEqual([]);
    expect(proyeccionSchema.safeParse(base()).success).toBe(true);
  });
});
