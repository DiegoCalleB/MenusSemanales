import { describe, expect, it } from "vitest";
import { parsearAgenda } from "./agenda";
import type { ProyeccionCalendario } from "./calendario-suscrito";
import {
  buscarTareaDeCasa,
  cuandoHablado,
  hablarDeLaCasa,
  hablarDeLaMochila,
  hablarDeLoGuardado,
  hablarDeLosAvisos,
  hablarDeManana,
  hablarDelTiempo,
  pendientesDeSesion,
  planDeFrase,
  preguntaDeCita,
  sinEmoji,
  textoDeCita,
} from "./conchi";
import type { ItemCaptura } from "./ia-captura";

const HOY = "2026-11-02"; // lunes
const tarea = (titulo: string, extra = {}) => ({
  titulo,
  emoji: "🏠",
  cadaDias: 14,
  responsableId: null,
  ultimaVez: null,
  desde: "2026-10-01",
  aplazadaHasta: null,
  ...extra,
});
const base = (extra: Partial<ProyeccionCalendario> = {}): ProyeccionCalendario => ({
  personas: [
    { id: "diego", nombre: "Diego", tipo: "adulto", activa: true },
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
const item = (extra: Partial<ItemCaptura>): ItemCaptura => ({
  tipo: "compra",
  titulo: "leche",
  fecha: null,
  hasta: null,
  hora: null,
  persona: null,
  importante: false,
  repiteMeses: null,
  categoria: "otro",
  ...extra,
});

describe("conchi: repartir una frase", () => {
  it("la compra y los pendientes se guardan; las citas, tras confirmar", () => {
    const plan = planDeFrase([
      item({ tipo: "compra", titulo: "pañales" }),
      item({ tipo: "pendiente", titulo: "llamar al dentista" }),
      item({ tipo: "evento", titulo: "Psicotécnico", fecha: "2026-12-03", hora: "18:00" }),
      item({ tipo: "papel", titulo: "ITV", fecha: "2026-12-04" }),
      item({ tipo: "evento", titulo: "Sin día", fecha: null }),
      item({ tipo: "compra", titulo: "   " }),
    ]);
    expect(plan.directas.map((d) => [d.tipo, d.texto])).toEqual([
      ["compra", "pañales"],
      ["pendiente", "llamar al dentista"],
      ["pendiente", "Sin día"],
    ]);
    expect(plan.porConfirmar).toEqual([
      { tipo: "cita", texto: "Psicotécnico", fecha: "2026-12-03", hora: "18:00" },
      { tipo: "cita", texto: "ITV", fecha: "2026-12-04", hora: null },
    ]);
  });

  it("dice qué ha apuntado y pregunta por las citas con el día bien dicho", () => {
    const plan = planDeFrase([
      item({ titulo: "leche" }),
      item({ titulo: "pan" }),
      item({ tipo: "pendiente", titulo: "llamar al dentista" }),
    ]);
    expect(hablarDeLoGuardado(plan.directas)).toBe(
      "Apuntado: leche y pan en la compra, y llamar al dentista en pendientes.",
    );
    expect(hablarDeLoGuardado([])).toBe("");
    const cita = {
      tipo: "cita",
      texto: "Psicotécnico",
      fecha: "2026-11-05",
      hora: "18:00",
    } as const;
    expect(preguntaDeCita(cita, HOY)).toBe(
      "¿Apunto Psicotécnico el jueves 5 de noviembre a las 18:00? Di sí o no.",
    );
    expect(cuandoHablado("2026-11-02", null, HOY)).toBe("hoy");
    expect(cuandoHablado("2026-11-03", "09:05", HOY)).toBe("mañana a las 9:05");
  });

  it("las citas por confirmar viajan en la sesión; lo raro se ignora", () => {
    const cita = { tipo: "cita", texto: "x", fecha: "2026-12-03", hora: null };
    expect(pendientesDeSesion({ porConfirmar: [cita] })).toEqual([cita]);
    expect(pendientesDeSesion({ porConfirmar: [{ tipo: "borrar" }] })).toEqual([]);
    expect(pendientesDeSesion(undefined)).toEqual([]);
  });

  it("el texto de la cita lo entiende «Apuntado» de la app", () => {
    const texto = textoDeCita("2026-12-03", "18:00", "Psicotécnico");
    expect(texto).toBe("3 diciembre 2026 18:00 Psicotécnico");
    const leida = parsearAgenda(texto, HOY).conFecha[0];
    expect(leida).toMatchObject({ fecha: "2026-12-03", hora: "18:00", titulo: "Psicotécnico" });
    const sinHora = parsearAgenda(textoDeCita("2026-12-04", null, "ITV"), HOY).conFecha[0];
    expect(sinHora).toMatchObject({ fecha: "2026-12-04", hora: null, titulo: "ITV" });
  });
});

describe("conchi: lo que lee", () => {
  it("mañana: citas y fechas señaladas", () => {
    const p = base({
      agenda: [{ fecha: "2026-11-03", hasta: null, hora: "09:30", titulo: "Pediatra" }],
    });
    expect(hablarDeManana(p, HOY)).toBe("Mañana tienes Pediatra a las 9:30.");
    expect(hablarDeManana(base(), HOY)).toBe("Mañana no tienes nada apuntado.");
  });

  it("la mochila: lo que hay que dejar preparado esta noche", () => {
    const p = base({
      mochila: [{ personaId: "alba", texto: "Carpeta de piano", dias: [2], fecha: null, antes: 1 }],
    });
    expect(hablarDeLaMochila(p, HOY)).toBe("Hay que dejar preparado: Carpeta de piano de Alba.");
    expect(hablarDeLaMochila(base(), HOY)).toBe("No hay nada que preparar para el cole.");
  });

  it("la casa: las tareas de hoy, o atrasadas", () => {
    const p = base({ casa: [tarea("Areneros"), tarea("Sábanas", { desde: "2026-12-01" })] });
    expect(hablarDeLaCasa(p, HOY)).toBe("Hoy toca en casa: Areneros.");
    expect(hablarDeLaCasa(base(), HOY)).toBe("Hoy no toca nada en casa.");
  });

  it("el tiempo, y el resumen con solo lo que haya", () => {
    const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, prob: 0, mm: 0, codigo: 2 }));
    const frio = [{ fecha: HOY, codigo: 2, max: 8, min: 1, probLluvia: 0, lluviaMm: 0, horas }];
    const p = base({ casa: [tarea("Areneros")] });
    expect(hablarDelTiempo(p, HOY, frio)).toContain("Frío");
    expect(hablarDelTiempo(p, HOY, [])).toBe("Hoy no hay nada especial con el tiempo.");
    const r = hablarDeLosAvisos(p, HOY, frio);
    expect(r).toContain("Hoy toca en casa: Areneros.");
    expect(r).toContain("Frío");
    expect(r).not.toContain("No hay nada");
    expect(hablarDeLosAvisos(base(), HOY, [])).toBe("Hoy no tienes nada pendiente.");
  });

  it("quita el emoji de los títulos", () => {
    expect(sinEmoji("🎒 Flauta · Diego")).toBe("Flauta · Diego");
    expect(sinEmoji("🧣 Frío (mín. 3 °C)")).toBe("Frío (mín. 3 °C)");
    expect(sinEmoji("Sin emoji")).toBe("Sin emoji");
  });
});

describe("conchi: «ya he hecho…»", () => {
  const p = base({
    casa: [tarea("Poner la lavadora"), tarea("Cambiar sábanas"), tarea("Limpiar areneros")],
  });
  it("encuentra la tarea por sus palabras", () => {
    expect(buscarTareaDeCasa(p, "la lavadora")).toBe("Poner la lavadora");
    expect(buscarTareaDeCasa(p, "las sábanas")).toBe("Cambiar sábanas");
    expect(buscarTareaDeCasa(p, "areneros")).toBe("Limpiar areneros");
  });
  it("si no hay una clara, null", () => {
    expect(buscarTareaDeCasa(p, "la colada")).toBeNull();
    expect(buscarTareaDeCasa(p, "")).toBeNull();
    expect(buscarTareaDeCasa(p, undefined)).toBeNull();
    const dos = base({ casa: [tarea("Limpiar baño"), tarea("Limpiar cocina")] });
    expect(buscarTareaDeCasa(dos, "limpiar")).toBeNull();
  });
});
