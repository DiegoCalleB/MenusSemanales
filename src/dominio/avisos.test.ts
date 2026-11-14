import { describe, expect, it } from "vitest";
import {
  type EntradaAvisos,
  avisosAntesDelCole,
  avisosDeHoy,
  avisosDeLaNoche,
  notificacionAntesDelCole,
  notificacionDeLaNoche,
  avisosQueImportan,
  direccionesDeAvisos,
  entradaDeProyeccion,
  fechaLarga,
  notificacionDelDia,
  resumenDelDia,
} from "./avisos";
import type { ProyeccionCalendario } from "./calendario-suscrito";

const base: EntradaAvisos = {
  hoy: "2026-11-03",
  cenaHoy: ["Pollo empanado", "Sopa"],
  cenaManana: ["Huevos"],
  comidaHoy: [],
  citas: [],
  tareas: [],
  cumples: [],
};
const ids = (e: EntradaAvisos) => avisosDeHoy(e).map((a) => a.id);

describe("avisos del día", () => {
  it("la fecha larga sale en español", () => {
    expect(fechaLarga("2026-11-03")).toBe("martes 3 de noviembre");
  });

  it("con la cena elegida, solo informa; sin cena, pide elegirla", () => {
    expect(avisosDeHoy(base).map((a) => [a.id, a.nivel])).toEqual([["cena-hoy", "info"]]);
    const sin = avisosDeHoy({ ...base, cenaHoy: [] });
    expect(sin[0]).toMatchObject({ id: "cena-hoy-falta", nivel: "ya" });
  });

  it("avisa de la cena de mañana si falta, salvo que mañana no se cene en casa", () => {
    expect(ids({ ...base, cenaManana: [] })).toContain("cena-manana-falta");
    expect(ids({ ...base, cenaManana: [], mananaSinCena: true })).not.toContain(
      "cena-manana-falta",
    );
  });

  it("cumpleaños: a 30, 14, 7, 3, 1 y 0 días, no entre medias", () => {
    const c = (mes: number, dia: number) => ({ ...base, cumples: [{ nombre: "Ana", mes, dia }] });
    expect(ids(c(11, 3))[0]).toBe("cumple-Ana-0"); // hoy
    expect(ids(c(11, 10))[0]).toBe("cumple-Ana-7");
    expect(ids(c(12, 3))[0]).toBe("cumple-Ana-30");
    expect(ids(c(11, 8)).some((i) => i.startsWith("cumple"))).toBe(false); // a 5 días
    const a30 = avisosDeHoy(c(12, 3)).find((a) => a.id === "cumple-Ana-30");
    expect(a30?.detalle).toBe("Empezad a pensar el regalo");
    expect(avisosDeHoy(c(11, 3)).find((a) => a.id === "cumple-Ana-0")?.nivel).toBe("ya");
  });

  it("citas de hoy y de mañana, no de otros días, ordenadas", () => {
    const e = {
      ...base,
      citas: [
        { fecha: "2026-11-04", titulo: "Dentista", hora: "17:00" },
        { fecha: "2026-11-03", titulo: "Reunión", hora: "09:00" },
        { fecha: "2026-11-20", titulo: "Lejos", hora: null },
      ],
    };
    const citas = avisosDeHoy(e).filter((a) => a.id.startsWith("cita"));
    expect(citas.map((a) => a.titulo)).toEqual(["Hoy 09:00: Reunión", "Mañana 17:00: Dentista"]);
  });

  it("lo que toca en casa, atrasado o de hoy, en un solo aviso con tope", () => {
    const t = (n: number, desde: string) => ({
      id: `t${n}`,
      titulo: `Tarea ${n}`,
      emoji: "🧺",
      cadaDias: 7,
      responsableId: null,
      ultimaVez: null,
      desde,
    });
    const tareas = [1, 2, 3, 4, 5, 6, 7]
      .map((n) => t(n, "2026-11-01"))
      .concat([t(8, "2026-12-01")]);
    const casa = avisosDeHoy({ ...base, tareas }).find((a) => a.id === "casa-hoy");
    expect(casa?.titulo).toContain("tocan");
    expect(casa?.titulo).toContain("y 2 más");
    expect(casa?.titulo).not.toContain("Tarea 8");
  });

  it("primero lo que pide algo hoy, luego lo que se acerca y al final lo informativo", () => {
    const e = {
      ...base,
      cenaManana: [],
      comidaHoy: ["Paella"],
      citas: [{ fecha: "2026-11-03", titulo: "Reunión", hora: null }],
    };
    expect(avisosDeHoy(e).map((a) => a.nivel)).toEqual(["ya", "pronto", "info", "info"]);
    expect(avisosQueImportan(avisosDeHoy(e))).toHaveLength(2);
  });
});

describe("resumen y notificación", () => {
  const avisos = avisosDeHoy({ ...base, comidaHoy: ["Paella"], cenaManana: [] });

  it("el resumen lleva asunto, texto y HTML escapado", () => {
    const peligroso = avisosDeHoy({
      ...base,
      citas: [{ fecha: "2026-11-03", titulo: "<b>x</b> & y", hora: null }],
    });
    const r = resumenDelDia("2026-11-03", peligroso);
    expect(r.asunto).toContain("martes 3 de noviembre");
    expect(r.asunto).toContain("cena Pollo empanado + Sopa");
    expect(r.html).not.toContain("<b>x</b>");
    expect(r.html).toContain("&lt;b&gt;x&lt;/b&gt; &amp; y");
    expect(r.texto).toContain("🍝 Cena: Pollo empanado + Sopa");
  });

  it("la notificación es corta: título con la cena y hasta tres avisos", () => {
    const n = notificacionDelDia("2026-11-03", avisos);
    expect(n.titulo).toBe("Hoy cena: Pollo empanado + Sopa");
    expect(n.cuerpo.split("\n").length).toBeLessThanOrEqual(3);
    expect(n.cuerpo.length).toBeLessThanOrEqual(240);
  });
});

describe("a partir del resumen de la base de datos", () => {
  const p: ProyeccionCalendario = {
    personas: [],
    cenas: [
      { fecha: "2026-11-03", nombre: "Pollo empanado" },
      { fecha: "2026-11-03", nombre: "Sopa" },
    ],
    almuerzos: [{ fecha: "2026-11-03", texto: "Paella" }],
    eventos: {},
    agenda: [{ fecha: "2026-11-03", hasta: null, hora: "18:15", titulo: "Psicotécnico" }],
    casa: [
      {
        titulo: "Sábanas",
        emoji: "🛏️",
        cadaDias: 14,
        responsableId: null,
        ultimaVez: null,
        desde: "2026-11-02",
      },
    ],
    cumples: [{ nombre: "Diego", dia: 7, mes: 11 }],
  };
  it("saca cena, comida, cita, casa y cumple del día", () => {
    const e = entradaDeProyeccion(p, "2026-11-03");
    expect(e.cenaHoy).toEqual(["Pollo empanado", "Sopa"]);
    expect(e.comidaHoy).toEqual(["Paella"]);
    const idsDe = avisosDeHoy(e).map((a) => a.id);
    expect(idsDe).toEqual(
      expect.arrayContaining(
        ["cena-hoy", "comida-hoy", "casa-hoy", "cumple-Diego-4"].filter(
          (i) => i !== "cumple-Diego-4",
        ),
      ),
    );
    expect(idsDe.some((i) => i.startsWith("cita-2026-11-03"))).toBe(true);
  });
});

describe("direccionesDeAvisos", () => {
  it("separa por comas o espacios y descarta lo que no es un correo", () => {
    expect(direccionesDeAvisos("a@b.test, c@d.test  x ;e@f.test")).toEqual([
      "a@b.test",
      "c@d.test",
      "e@f.test",
    ]);
    expect(direccionesDeAvisos(undefined)).toEqual([]);
  });
});

describe("avisos de qué llevar (D-136) y del domingo (D-137)", () => {
  const patines = { texto: "Patines", persona: "Emma", dias: [5], fecha: null, antes: 1 };

  it("el jueves avisa de dejar preparados los patines del viernes", () => {
    // 2026-11-19 es jueves.
    const a = avisosDeHoy({ ...base, hoy: "2026-11-19", mochila: [patines] });
    expect(a.find((x) => x.emoji === "🎒")).toMatchObject({
      titulo: "Deja preparado: Patines de Emma (para mañana)",
      nivel: "ya",
    });
    expect(
      avisosDeHoy({ ...base, hoy: "2026-11-18", mochila: [patines] }).some((x) => x.emoji === "🎒"),
    ).toBe(false);
  });

  it("si ya está preparado, no avisa", () => {
    const hecho = { ...patines, preparadas: ["2026-11-20"] };
    expect(
      avisosDeHoy({ ...base, hoy: "2026-11-19", mochila: [hecho] }).some((x) => x.emoji === "🎒"),
    ).toBe(false);
  });

  it("el domingo propone planear la semana con las cenas que faltan y las citas", () => {
    // 2026-11-15 es domingo; la semana es del 16 al 22.
    const a = avisosDeHoy({
      ...base,
      hoy: "2026-11-15",
      diasConCena: ["2026-11-16", "2026-11-17"],
      diasSinCena: ["2026-11-21"],
      citas: [{ fecha: "2026-11-18", titulo: "AMPA", hora: "16:00" }],
    });
    expect(a.find((x) => x.id === "plan-semana-2026-11-15")?.titulo).toBe(
      "Planea la semana: faltan 4 cenas, 1 cita",
    );
    expect(
      avisosDeHoy({ ...base, diasConCena: [] }).some((x) => x.id.startsWith("plan-semana")),
    ).toBe(false);
  });
});

describe("recordatorio de la noche (D-139)", () => {
  it("solo lo que hay que preparar hoy y las citas de mañana", () => {
    const a = avisosDeLaNoche({
      ...base,
      hoy: "2026-11-19",
      citas: [
        { fecha: "2026-11-19", titulo: "Hoy no", hora: "10:00" },
        { fecha: "2026-11-20", titulo: "Dentista", hora: "9:30" },
      ],
      mochila: [{ texto: "Patines", persona: "Emma", dias: [5], fecha: null, antes: 1 }],
    });
    expect(a.map((x) => x.titulo)).toEqual([
      "Deja preparado: Patines de Emma (para mañana)",
      "Mañana 9:30: Dentista",
    ]);
    expect(notificacionDeLaNoche(a).titulo).toBe("🎒 Antes de dormir");
    expect(avisosDeLaNoche({ ...base, hoy: "2026-11-18" })).toEqual([]);
  });
});

describe("avisos y calendario escolar (D-144)", () => {
  const patines = { texto: "Patines", persona: "Emma", dias: [5], fecha: null, antes: 1 };

  it("el jueves antes de un viernes sin cole no pide preparar los patines", () => {
    // 2027-02-12 (viernes) es día no lectivo.
    const a = avisosDeHoy({ ...base, hoy: "2027-02-11", mochila: [patines], conCole: true });
    expect(a.some((x) => x.emoji === "🎒")).toBe(false);
    expect(a.find((x) => x.id === "cole-no-2027-02-12")?.titulo).toBe(
      "Mañana no hay cole: Día no lectivo",
    );
    // Si son de fuera del cole, sí.
    const fuera = { ...patines, soloConCole: false };
    expect(
      avisosDeHoy({ ...base, hoy: "2027-02-11", mochila: [fuera] }).some((x) => x.emoji === "🎒"),
    ).toBe(true);
  });

  it("avisa el primer día de un parón y la víspera de la vuelta, no cada día de vacaciones", () => {
    const ids2 = (hoy: string) =>
      ids({ ...base, hoy, conCole: true }).filter((i) => i.startsWith("cole-"));
    expect(ids2("2026-12-22")).toEqual(["cole-no-2026-12-23"]);
    expect(ids2("2026-12-27")).toEqual([]); // domingo en mitad de Navidad
    expect(ids2("2026-12-28")).toEqual([]);
    // El viernes 8 de enero es no lectivo y el lunes 11 se vuelve: se avisa el domingo 10.
    expect(ids2("2027-01-10")).toEqual(["cole-vuelve-2027-01-11"]);
    // Viernes antes del puente de diciembre: se avisa ya el viernes (D-149) y otra vez el domingo.
    expect(ids2("2026-12-04")).toEqual(["cole-no-2026-12-07"]);
    expect(ids2("2026-12-05")).toEqual([]);
    expect(ids2("2026-12-06")).toEqual(["cole-no-2026-12-07"]);
    // Un fin de semana normal, nada.
    expect(ids2("2026-11-15")).toEqual([]);
  });

  it("el viernes avisa del lunes sin cole y de la vuelta, con margen (D-149)", () => {
    const titulos = (hoy: string) =>
      avisosDeLaNoche({ ...base, hoy, conCole: true })
        .filter((a) => a.id.startsWith("cole-"))
        .map((a) => a.titulo);
    expect(titulos("2026-12-04")).toEqual(["El lunes no hay cole: Día de la Constitución"]);
    // Viernes 8 de enero (no lectivo): el lunes 11 se vuelve.
    expect(titulos("2027-01-08")).toEqual(["El lunes vuelve el cole"]);
  });

  it("sin nada del cole en el hogar, no avisa de días sin cole", () => {
    expect(ids({ ...base, hoy: "2026-12-22" }).some((i) => i.startsWith("cole-"))).toBe(false);
  });

  it("el día que apunta la familia también cuenta, y entra en el recordatorio de la noche", () => {
    const e = {
      ...base,
      hoy: "2026-11-23",
      conCole: true,
      diasCole: [{ fecha: "2026-11-24", hay: false, motivo: "Libre disposición" }],
    };
    expect(avisosDeLaNoche(e).map((a) => a.titulo)).toEqual([
      "Mañana no hay cole: Libre disposición",
    ]);
  });
});

describe("el tiempo en los avisos (D-145)", () => {
  const tiempo = [
    { fecha: "2026-11-19", codigo: 80, max: 14, min: 9, probLluvia: 70, lluviaMm: 3 },
    { fecha: "2026-11-20", codigo: 1, max: 12, min: 2, probLluvia: 0, lluviaMm: 0 },
  ];

  it("por la mañana, el de hoy; por la noche, el de mañana después de la mochila", () => {
    const e = {
      ...base,
      hoy: "2026-11-19",
      tiempo,
      mochila: [{ texto: "Patines", persona: "Emma", dias: [5], fecha: null, antes: 1 }],
    };
    expect(avisosDeHoy(e).find((a) => a.id.startsWith("tiempo-"))).toEqual({
      id: "tiempo-2026-11-19-lluvia",
      emoji: "🌧️",
      titulo: "Hoy, lluvia (70 %): chubasquero y botas",
      nivel: "ya",
    });
    expect(avisosDeLaNoche(e).map((a) => a.titulo)).toEqual([
      "Deja preparado: Patines de Emma (para mañana)",
      "Mañana, frío (mín. 2 °C): abrigo, gorro y guantes",
    ]);
  });

  it("solo el tiempo ya basta para mandar el aviso de la noche; sin previsión, nada", () => {
    expect(avisosDeLaNoche({ ...base, hoy: "2026-11-19", tiempo }).length).toBe(1);
    expect(avisosDeLaNoche({ ...base, hoy: "2026-11-19", tiempo: [] })).toEqual([]);
  });
});

describe("el paraguas a la hora del cole (D-148)", () => {
  const horas = (lluvia: number[]) =>
    Array.from({ length: 24 }, (_, hora) => ({
      hora,
      prob: lluvia.includes(hora) ? 70 : 0,
      mm: lluvia.includes(hora) ? 1 : 0,
      codigo: lluvia.includes(hora) ? 61 : 2,
    }));
  // Jueves 19 y viernes 20 de noviembre: días de cole.
  const tiempo = [
    {
      fecha: "2026-11-19",
      codigo: 61,
      max: 14,
      min: 9,
      probLluvia: 70,
      lluviaMm: 3,
      horas: horas([9]),
    },
    {
      fecha: "2026-11-20",
      codigo: 61,
      max: 14,
      min: 9,
      probLluvia: 70,
      lluviaMm: 3,
      horas: horas([15, 16]),
    },
    {
      fecha: "2026-11-21",
      codigo: 61,
      max: 14,
      min: 9,
      probLluvia: 70,
      lluviaMm: 3,
      horas: horas([9]),
    },
  ];
  const cole = { ...base, conCole: true, tiempo };

  it("antes de salir de casa, si llueve a la ida: paraguas", () => {
    expect(avisosAntesDelCole({ ...cole, hoy: "2026-11-19" })).toEqual([
      {
        id: "tiempo-2026-11-19-paraguas",
        emoji: "🌂",
        titulo: "Hoy llueve de camino al cole (de 8 a 9 h, 70 %): paraguas y chubasquero",
        nivel: "ya",
      },
    ]);
    expect(notificacionAntesDelCole(avisosAntesDelCole({ ...cole, hoy: "2026-11-19" }))).toEqual({
      titulo: "🌂 Coged el paraguas",
      cuerpo: "Hoy llueve de camino al cole (de 8 a 9 h, 70 %): paraguas y chubasquero",
    });
  });

  it("sin la previsión hora a hora, ante la duda se avisa por el día", () => {
    const sinHoras = tiempo.map((t) => ({ ...t, horas: undefined }));
    expect(
      avisosAntesDelCole({ ...cole, hoy: "2026-11-19", tiempo: sinHoras }).map((a) => a.titulo),
    ).toEqual(["Hoy puede llover a la hora del cole (70 % en el día): paraguas y chubasquero"]);
  });

  it("si solo llueve a la vuelta, el paraguas se coge igual al salir", () => {
    expect(avisosAntesDelCole({ ...cole, hoy: "2026-11-20" }).map((a) => a.titulo)).toEqual([
      "Hoy llueve a la salida del cole (de 14 a 16 h, 70 %): salid con paraguas",
    ]);
  });

  it("sin cole (fin de semana, día sin cole o un hogar sin cole) o sin lluvia, nada", () => {
    expect(avisosAntesDelCole({ ...cole, hoy: "2026-11-21" })).toEqual([]);
    expect(
      avisosAntesDelCole({
        ...cole,
        hoy: "2026-11-19",
        diasCole: [{ fecha: "2026-11-19", hay: false, motivo: "Huelga" }],
      }),
    ).toEqual([]);
    expect(avisosAntesDelCole({ ...cole, hoy: "2026-11-19", conCole: false })).toEqual([]);
    expect(avisosAntesDelCole({ ...cole, hoy: "2026-11-19", tiempo: [] })).toEqual([]);
    const seco = tiempo.map((t) => ({ ...t, horas: horas([20]) }));
    expect(avisosAntesDelCole({ ...cole, hoy: "2026-11-19", tiempo: seco })).toEqual([]);
  });

  it("la noche antes dice a qué hora llueve, en vez de la lluvia del día", () => {
    const titulos = avisosDeLaNoche({ ...cole, hoy: "2026-11-18" }).map((a) => a.titulo);
    expect(titulos).toContain(
      "Mañana llueve de camino al cole (de 8 a 9 h, 70 %): paraguas y chubasquero",
    );
    expect(titulos.some((t) => t.includes("Mañana, lluvia"))).toBe(false);
    // El sábado no hay cole: el aviso del día, como siempre.
    expect(avisosDeLaNoche({ ...cole, hoy: "2026-11-20" }).map((a) => a.titulo)).toContain(
      "Mañana, lluvia (70 %): chubasquero y botas",
    );
  });
});

describe("el viernes, la semana que viene (D-149)", () => {
  it("días sin cole, lo de llevar un día concreto y las citas, por días", () => {
    const e = {
      ...base,
      hoy: "2026-11-27", // viernes
      conCole: true,
      diasCole: [{ fecha: "2026-11-30", hay: false, motivo: "Libre disposición" }],
      mochila: [
        { texto: "Disfraz", persona: "Emma", dias: [], fecha: "2026-12-02", antes: 1 },
        { texto: "Patines", persona: "Emma", dias: [5], fecha: null, antes: 1 },
      ],
      citas: [
        { fecha: "2026-12-03", titulo: "Dentista", hora: "17:00" },
        { fecha: "2026-12-10", titulo: "Lejos", hora: null },
      ],
    };
    const semana = avisosDeLaNoche(e).find((a) => a.id === "semana-que-viene-2026-11-30");
    expect(semana?.titulo).toBe(
      "La semana que viene: lunes sin cole (Libre disposición), miércoles Disfraz de Emma, jueves 17:00 Dentista",
    );
  });

  it("toda la semana sin cole se dice una vez; sin nada, no sale; otro día, tampoco", () => {
    const navidad = avisosDeHoy({ ...base, hoy: "2026-12-25", conCole: true }).find((a) =>
      a.id.startsWith("semana-que-viene-"),
    );
    expect(navidad?.titulo).toBe(
      "La semana que viene: sin cole toda la semana (Vacaciones de Navidad)",
    );
    expect(
      avisosDeHoy({ ...base, hoy: "2026-11-20" }).some((a) => a.id.startsWith("semana-que-viene-")),
    ).toBe(false);
    expect(
      avisosDeHoy({ ...base, hoy: "2026-11-26", conCole: true }).some((a) =>
        a.id.startsWith("semana-que-viene-"),
      ),
    ).toBe(false);
  });
});

describe("calendario escolar nuevo (D-146)", () => {
  const cursosNuevos = [
    {
      nombre: "Curso 2027/2028 · Madrid capital",
      inicio: "2027-09-08",
      cambiadoEn: "2027-06-01T07:41:00Z",
    },
  ];
  it("se avisa el día que se carga y los dos siguientes, no después", () => {
    const titulo = (hoy: string) =>
      avisosDeHoy({ ...base, hoy, conCole: true, cursosNuevos }).find((a) =>
        a.id.startsWith("calendario-escolar-"),
      )?.titulo;
    expect(titulo("2027-06-01")).toBe(
      "Calendario escolar al día: Curso 2027/2028, empieza el miércoles 8 de septiembre",
    );
    expect(titulo("2027-06-03")).toBeDefined();
    expect(titulo("2027-06-04")).toBeUndefined();
    expect(
      avisosDeHoy({ ...base, hoy: "2027-06-01", cursosNuevos }).some((a) =>
        a.id.startsWith("calendario-escolar-"),
      ),
    ).toBe(false);
  });
});
