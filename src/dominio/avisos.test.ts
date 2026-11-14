import { describe, expect, it } from "vitest";
import {
  type EntradaAvisos,
  avisosDeHoy,
  avisosDeLaNoche,
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
    // Viernes antes del puente de diciembre: el aviso llega el domingo 6.
    expect(ids2("2026-12-04")).toEqual([]);
    expect(ids2("2026-12-06")).toEqual(["cole-no-2026-12-07"]);
    // Un fin de semana normal, nada.
    expect(ids2("2026-11-15")).toEqual([]);
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
