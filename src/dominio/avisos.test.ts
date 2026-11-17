import { describe, expect, it } from "vitest";
import {
  type EntradaAvisos,
  avisosAntesDelCole,
  avisosDeHoy,
  avisosDeLaNoche,
  cosaDeLluvia,
  cosasParaMarcar,
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

  it("la noche antes, la lluvia es algo que dejar preparado y dice a qué hora llueve (D-176)", () => {
    const noche = avisosDeLaNoche({ ...cole, hoy: "2026-11-18" });
    const lluvia = noche.find((a) => a.id === "mochila-2026-11-19-lluvia");
    expect(lluvia?.titulo).toBe("Deja preparado: paraguas y ropa de lluvia (para mañana)");
    expect(lluvia?.detalle).toBe("Mañana llueve de camino al cole (de 8 a 9 h, 70 %)");
    expect(noche.some((a) => a.titulo.includes("Mañana, lluvia"))).toBe(false);
    // El sábado no hay cole: también, con la lluvia del día.
    const sabado = avisosDeLaNoche({ ...cole, hoy: "2026-11-20" });
    expect(sabado.find((a) => a.id === "mochila-2026-11-21-lluvia")?.detalle).toBe(
      "Mañana lluvia (70 %)",
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

describe("una semana antes de un puente o unas vacaciones (D-156)", () => {
  const titulo = (hoy: string) =>
    avisosDeHoy({ ...base, hoy, conCole: true }).find((a) => a.id.startsWith("cole-semana-"))
      ?.titulo;

  it("el puente de diciembre se avisa el lunes de antes, con los dos días y sus motivos", () => {
    expect(titulo("2026-11-30")).toBe(
      "En una semana no hay cole: lunes 7 y martes 8 (Día de la Constitución, La Inmaculada)",
    );
    expect(titulo("2026-11-29")).toBeUndefined();
    expect(titulo("2026-12-01")).toBeUndefined();
  });

  it("unas vacaciones largas, de qué día a qué día", () => {
    expect(titulo("2026-12-16")).toMatch(
      /^En una semana no hay cole: del miércoles 23 de diciembre al /,
    );
  });

  it("sin nada del cole en el hogar, no avisa", () => {
    expect(
      avisosDeHoy({ ...base, hoy: "2026-11-30" }).some((a) => a.id.startsWith("cole-semana-")),
    ).toBe(false);
  });
});

describe("el estadio de al lado (D-159)", () => {
  const estadio = [
    {
      id: "partido-2",
      fecha: "2026-12-06",
      hora: "21:00",
      tipo: "partido" as const,
      titulo: "Atlético – Real Betis (Liga)",
    },
  ];

  it("el mismo día por la mañana y la víspera por la noche", () => {
    expect(
      avisosDeHoy({ ...base, hoy: "2026-12-06", estadio }).find((a) => a.id.startsWith("estadio-")),
    ).toMatchObject({
      titulo: "Hoy partido en el Metropolitano a las 21:00: Atlético – Real Betis (Liga)",
      nivel: "ya",
    });
    expect(avisosDeLaNoche({ ...base, hoy: "2026-12-05", estadio }).map((a) => a.titulo)).toContain(
      "Mañana partido en el Metropolitano a las 21:00: Atlético – Real Betis (Liga)",
    );
  });

  it("y en el resumen del viernes", () => {
    // Viernes 27 de noviembre: la semana que viene va del lunes 30 al domingo 6.
    const semana = avisosDeLaNoche({ ...base, hoy: "2026-11-27", estadio }).find((a) =>
      a.id.startsWith("semana-que-viene-"),
    );
    expect(semana?.titulo).toContain(
      "domingo 21:00 partido en el Metropolitano (Atlético – Real Betis (Liga))",
    );
  });

  it("si ese día hay otra cosa apuntada, el aviso dice que coincide (D-163)", () => {
    const e = {
      ...base,
      hoy: "2026-12-05",
      estadio,
      citas: [{ fecha: "2026-12-06", titulo: "Comida en casa de la abuela", hora: "14:00" }],
    };
    expect(avisosDeLaNoche(e).find((a) => a.id.startsWith("estadio-"))).toMatchObject({
      emoji: "⚠️",
      titulo:
        "Mañana partido en el Metropolitano a las 21:00: Atlético – Real Betis (Liga) · coincide con Comida en casa de la abuela",
    });
  });
});

describe("el barrio el fin de semana (D-165)", () => {
  const plan = (
    id: string,
    fecha: string,
    hora: string | null,
    titulo: string,
    familiar = true,
  ) => ({
    id,
    fecha,
    hasta: null,
    hora,
    titulo,
    lugar: "Biblioteca Pública Municipal Canillejas",
    barrio: "Canillejas",
    gratis: true,
    precio: null,
    enlace: null,
    familiar,
    serie: false,
    emoji: "🧸",
  });
  const barrio = [
    plan("1", "2026-11-21", "12:00", "El sueño de Lucía"),
    plan("2", "2026-11-22", "12:00", "La terrorífica historia de Aba"),
    plan("3", "2026-11-21", "19:00", "Aurora Vargas. Tradición Flamenca", false),
    plan("4", "2026-11-19", "18:00", "Cuentos entre semana"),
  ];

  it("el viernes avisa de lo que hay para la familia el sábado y el domingo, y nada más", () => {
    const a = avisosDeHoy({ ...base, hoy: "2026-11-20", barrio }).find((x) =>
      x.id.startsWith("barrio-finde-"),
    );
    expect(a?.titulo).toBe(
      "Este finde en el barrio: sáb 21 12:00 El sueño de Lucía (Canillejas), dom 22 12:00 La terrorífica historia de Aba (Canillejas)",
    );
    // Otro día, o sin planes de familia, nada.
    expect(
      avisosDeHoy({ ...base, hoy: "2026-11-19", barrio }).some((x) =>
        x.id.startsWith("barrio-finde-"),
      ),
    ).toBe(false);
    expect(
      avisosDeHoy({ ...base, hoy: "2026-11-20", barrio: [barrio[2]!] }).some((x) =>
        x.id.startsWith("barrio-finde-"),
      ),
    ).toBe(false);
    // También en el recordatorio del viernes por la noche.
    expect(
      avisosDeLaNoche({ ...base, hoy: "2026-11-20", barrio }).some((x) =>
        x.id.startsWith("barrio-finde-"),
      ),
    ).toBe(true);
  });
});

describe("avisos de papeles y vencimientos (D-174)", () => {
  const venc = (o: object = {}) => ({
    id: "v1",
    titulo: "ITV del coche",
    categoria: "coche" as const,
    personaId: null,
    fecha: "2026-11-27",
    repiteMeses: 12,
    avisos: [30, 7, 1],
    notas: "",
    hechoEn: null,
    renovado: [],
    ...o,
  });
  const papel = (hoy: string, vencimientos: ReturnType<typeof venc>[]) =>
    avisosDeHoy({ ...base, hoy, vencimientos, personas: [{ id: "alba", nombre: "Alba" }] }).filter(
      (a) => a.id.startsWith("papel-"),
    );
  it("avisa a los siete días con el nivel «pronto» y empieza con mayúscula", () => {
    const a = papel("2026-11-20", [venc()]);
    expect(a).toEqual([
      { id: "papel-v1-7", emoji: "📄", titulo: "ITV del coche vence en 7 días", nivel: "pronto" },
    ]);
  });
  it("el día antes y el mismo día piden hacer algo ya; entre medias, nada", () => {
    expect(papel("2026-11-26", [venc()])[0]?.nivel).toBe("ya");
    expect(papel("2026-11-23", [venc()])).toEqual([]);
  });
  it("ya vencido, avisa al día siguiente y a la semana", () => {
    expect(papel("2026-11-28", [venc()])[0]?.titulo).toBe("ITV del coche venció ayer");
    expect(papel("2026-12-04", [venc()])[0]?.titulo).toBe("ITV del coche venció hace 7 días");
    expect(papel("2026-11-30", [venc()])).toEqual([]);
  });
  it("pone de quién es y no avisa de lo hecho", () => {
    expect(papel("2026-11-20", [venc({ titulo: "Pasaporte", personaId: "alba" })])[0]?.titulo).toBe(
      "Pasaporte de Alba vence en 7 días",
    );
    expect(papel("2026-11-20", [venc({ hechoEn: "2026-11-01" })])).toEqual([]);
  });
});

describe("recordatorio de pendientes sin fecha (D-175)", () => {
  const pen = (o: object = {}) => ({
    id: "p1",
    texto: "Llamar al fontanero",
    personaId: null,
    importante: false,
    creadoEn: "2026-11-01",
    hechoEn: null,
    ...o,
  });
  const aviso = (hoy: string, pendientes: ReturnType<typeof pen>[]) =>
    avisosDeHoy({ ...base, hoy, pendientes }).find((a) => a.id.startsWith("pendientes-semana-"));
  it("el domingo recuerda cuántos hay y el que más lleva", () => {
    // 2026-11-15 es domingo.
    expect(aviso("2026-11-15", [pen(), pen({ id: "p2", texto: "Pedir cita" })])).toEqual({
      id: "pendientes-semana-2026-11-15",
      emoji: "📝",
      titulo: "2 pendientes sin fecha",
      detalle: "Llamar al fontanero (hace 2 semanas)",
      nivel: "info",
    });
    expect(aviso("2026-11-15", [pen()])?.titulo).toBe("1 pendiente sin fecha");
  });
  it("solo los domingos, y solo si hay algo importante o que lleva una semana", () => {
    expect(aviso("2026-11-16", [pen()])).toBeUndefined();
    expect(aviso("2026-11-15", [pen({ creadoEn: "2026-11-13" })])).toBeUndefined();
    expect(
      aviso("2026-11-15", [pen({ creadoEn: "2026-11-13", importante: true })])?.detalle,
    ).toContain("⭐");
    expect(aviso("2026-11-15", [pen({ hechoEn: "2026-11-02" })])).toBeUndefined();
  });
});

describe("paraguas y ropa de lluvia como cosa que preparar (D-176)", () => {
  const horas = (lluvia: number[]) =>
    Array.from({ length: 24 }, (_, hora) => ({
      hora,
      prob: lluvia.includes(hora) ? 70 : 0,
      mm: lluvia.includes(hora) ? 1 : 0,
      codigo: lluvia.includes(hora) ? 61 : 2,
    }));
  const dia = (fecha: string, lluvia: number[], extra: object = {}) => ({
    fecha,
    codigo: lluvia.length > 0 ? 61 : 1,
    max: 14,
    min: 9,
    probLluvia: lluvia.length > 0 ? 70 : 0,
    lluviaMm: lluvia.length > 0 ? 3 : 0,
    horas: horas(lluvia),
    ...extra,
  });

  it("un día de cole, solo si moja a la ida o a la vuelta", () => {
    expect(cosaDeLluvia(dia("2026-11-20", [9]), true)).toEqual({
      texto: "Paraguas y ropa de lluvia",
      motivo: "llueve de camino al cole (de 8 a 9 h, 70 %)",
    });
    // Llueve por la tarde, ya en casa: no hace falta prepararlo para el cole.
    expect(cosaDeLluvia(dia("2026-11-20", [18, 19]), true)).toBeNull();
    expect(cosaDeLluvia(dia("2026-11-20", []), true)).toBeNull();
    expect(cosaDeLluvia(undefined, true)).toBeNull();
  });

  it("sin cole (fin de semana o festivo), si el día es de lluvia; con tormenta, siempre", () => {
    expect(cosaDeLluvia(dia("2026-11-21", [11]), false)?.motivo).toBe("lluvia (70 %)");
    expect(cosaDeLluvia(dia("2026-11-21", []), false)).toBeNull();
    const tormenta = dia("2026-11-20", [], { codigo: 95, probLluvia: 60, lluviaMm: 5 });
    expect(cosaDeLluvia(tormenta, true)?.motivo).toBe("tormentas");
  });

  const conColeBase = { ...base, conCole: true, hoy: "2026-11-19" };
  it("por la noche, si mañana llueve, sale con lo de la mochila y no repetida como aviso del tiempo", () => {
    const e = {
      ...conColeBase,
      tiempo: [dia("2026-11-20", [9], { min: 2 })],
      mochila: [{ texto: "Patines", persona: "Emma", dias: [5], fecha: null, antes: 1 }],
    };
    const noche = avisosDeLaNoche(e);
    expect(noche.map((a) => a.titulo)).toEqual([
      "Deja preparado: Patines de Emma (para mañana)",
      "Deja preparado: paraguas y ropa de lluvia (para mañana)",
      "Mañana, frío (mín. 2 °C): abrigo, gorro y guantes",
    ]);
    const lluvia = noche.find((a) => a.id === "mochila-2026-11-20-lluvia");
    expect(lluvia).toMatchObject({
      emoji: "☔",
      detalle: "Mañana llueve de camino al cole (de 8 a 9 h, 70 %)",
      nivel: "ya",
    });
    // No se manda también el aviso general del paraguas ni el de la lluvia.
    expect(noche.some((a) => /paraguas y chubasquero|chubasquero y botas/.test(a.titulo))).toBe(
      false,
    );
    // Es «de la mochila», así que no tiene botón «Hecho» (no es algo apuntado en la mochila).
    expect(cosasParaMarcar(noche).some((c) => /lluvia/i.test(c.texto))).toBe(false);
    expect(notificacionDeLaNoche(noche).titulo).toBe("🎒 Antes de dormir");
  });

  it("solo la lluvia ya basta para el aviso de la noche; sin lluvia, no sale", () => {
    const solo = avisosDeLaNoche({ ...conColeBase, tiempo: [dia("2026-11-20", [9])] });
    expect(solo.map((a) => a.id)).toEqual(["mochila-2026-11-20-lluvia"]);
    expect(notificacionDeLaNoche(solo)).toEqual({
      titulo: "🎒 Antes de dormir",
      cuerpo: "☔ Deja preparado: paraguas y ropa de lluvia (para mañana)",
    });
    expect(avisosDeLaNoche({ ...conColeBase, tiempo: [dia("2026-11-20", [])] })).toEqual([]);
  });

  it("el aviso de la mañana no cambia: sigue diciendo que se coja el paraguas", () => {
    const hoy = avisosDeHoy({ ...conColeBase, tiempo: [dia("2026-11-19", [9])] });
    expect(hoy.some((a) => a.id === "tiempo-2026-11-19-paraguas")).toBe(true);
  });
});
