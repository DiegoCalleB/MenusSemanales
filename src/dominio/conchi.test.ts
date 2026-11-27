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
import type { ItemConchi } from "./ia-conchi";

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
const AHORA = { fecha: HOY, minutos: 10 * 60 };
const item = (extra: Partial<ItemConchi>): ItemConchi => ({
  tipo: "compra",
  titulo: "leche",
  fecha: null,
  hora: null,
  ambigua: false,
  ...extra,
});

describe("conchi: repartir una frase", () => {
  it("la compra y los pendientes se guardan; las citas, tras confirmar; los recordatorios se ponen", () => {
    const plan = planDeFrase(
      [
        item({ tipo: "compra", titulo: "pañales" }),
        item({ tipo: "pendiente", titulo: "llamar al dentista" }),
        item({ tipo: "cita", titulo: "Psicotécnico", fecha: "2026-12-03", hora: "18:00" }),
        item({ tipo: "recordatorio", titulo: "sacar la basura", hora: "06:00", ambigua: true }),
        item({ tipo: "recordatorio", titulo: "sin hora" }),
        item({ tipo: "cita", titulo: "sin día" }),
        item({ tipo: "compra", titulo: "   " }),
      ],
      AHORA,
    );
    expect(plan.directas.map((d) => [d.tipo, d.texto])).toEqual([
      ["compra", "pañales"],
      ["pendiente", "llamar al dentista"],
      ["pendiente", "sin hora"],
      ["pendiente", "sin día"],
    ]);
    expect(plan.porConfirmar).toEqual([
      { tipo: "cita", texto: "Psicotécnico", fecha: "2026-12-03", hora: "18:00" },
    ]);
    expect(plan.recordatorios).toEqual([{ texto: "sacar la basura", fecha: HOY, hora: "18:00" }]);
  });

  it("un recordatorio imposible (ya pasó) se guarda como pendiente", () => {
    const plan = planDeFrase(
      [item({ tipo: "recordatorio", titulo: "x", hora: "09:00", fecha: HOY })],
      AHORA,
    );
    expect(plan.recordatorios).toEqual([]);
    expect(plan.directas.map((d) => d.tipo)).toEqual(["pendiente"]);
  });

  it("dice qué ha apuntado y pregunta por las citas con el día bien dicho", () => {
    const plan = planDeFrase(
      [
        item({ titulo: "leche" }),
        item({ titulo: "pan" }),
        item({ tipo: "pendiente", titulo: "llamar al dentista" }),
      ],
      AHORA,
    );
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

import {
  type Entrada,
  reducirEntradas,
  buscarEnLaCompra,
  datosParaPreguntar,
  elegir,
  hablarDeLaCompraApuntada,
  hablarDeLoQueLeToca,
  hablarDeLosPapeles,
  hablarDePendientes,
  hablarDeSiHayEnLaCompra,
  hablarDelEstadio,
  personaPorNombre,
  saludoDeLaHora,
} from "./conchi";

describe("conchi: la compra, los pendientes y los papeles", () => {
  it("lee la compra y busca en ella", () => {
    const l = ["Leche", "Pan de molde", "Huevos"];
    expect(hablarDeLaCompraApuntada(l)).toBe(
      "En la compra hay 3 cosas: Leche, Pan de molde y Huevos.",
    );
    expect(hablarDeLaCompraApuntada(["Sal"])).toBe("En la compra hay una cosa: Sal.");
    expect(hablarDeLaCompraApuntada([])).toBe("No hay nada apuntado en la compra.");
    expect(hablarDeSiHayEnLaCompra(l, "el pan")).toBe("Sí, Pan de molde está en la compra.");
    expect(hablarDeSiHayEnLaCompra(l, "arroz")).toBe("No, eso no está apuntado en la compra.");
    expect(buscarEnLaCompra(l, "la leche")).toBe("Leche");
    expect(buscarEnLaCompra(l, "arroz")).toBeNull();
    expect(buscarEnLaCompra(["Leche entera", "Leche sin lactosa"], "leche")).toBeNull();
  });

  it("los pendientes, con los importantes primero", () => {
    const p = base({
      pendientes: [
        {
          texto: "Llamar al fontanero",
          personaId: null,
          importante: false,
          creadoEn: HOY,
          hechoEn: null,
        },
        { texto: "Pedir cita", personaId: null, importante: true, creadoEn: HOY, hechoEn: null },
        { texto: "Ya hecho", personaId: null, importante: false, creadoEn: HOY, hechoEn: HOY },
      ],
    });
    expect(hablarDePendientes(p)).toBe("Hay 2 pendientes: Pedir cita y Llamar al fontanero.");
    expect(hablarDePendientes(base())).toBe("No hay nada pendiente.");
  });

  it("los papeles que vencen pronto", () => {
    const p = base({
      vencimientos: [
        {
          titulo: "ITV",
          categoria: "coche",
          personaId: null,
          fecha: "2026-10-20",
          avisos: [],
          hechoEn: null,
        },
        {
          titulo: "Seguro",
          categoria: "coche",
          personaId: null,
          fecha: "2026-12-04",
          avisos: [],
          hechoEn: null,
        },
        {
          titulo: "Pasaporte",
          categoria: "documentos",
          personaId: null,
          fecha: "2028-01-01",
          avisos: [],
          hechoEn: null,
        },
      ],
    });
    expect(hablarDeLosPapeles(p, HOY)).toBe(
      "Vence pronto: ITV, ya vencido y Seguro, el viernes 4 de diciembre.",
    );
    expect(hablarDeLosPapeles(base(), HOY)).toContain("No vence ningún papel");
  });

  it("el Metropolitano de hoy, o lo siguiente", () => {
    const ev = (fecha: string, titulo: string) => ({
      id: fecha,
      fecha,
      hora: "21:00",
      tipo: "partido" as const,
      titulo,
    });
    expect(hablarDelEstadio([ev(HOY, "Atlético – Betis")], HOY)).toContain("Atlético – Betis");
    expect(hablarDelEstadio([ev("2026-11-09", "Atlético – Real")], HOY)).toContain(
      "Lo siguiente es el lunes 9 de noviembre",
    );
    expect(hablarDelEstadio([], HOY)).toBe("Hoy no hay nada en el Metropolitano.");
  });
});

describe("conchi: quién habla y qué le toca", () => {
  it("encuentra a la persona por su nombre", () => {
    const p = base();
    expect(personaPorNombre(p, "Diego")).toEqual({ id: "diego", nombre: "Diego" });
    expect(personaPorNombre(p, "ALBA")).toEqual({ id: "alba", nombre: "Alba" });
    expect(personaPorNombre(p, "Pepe")).toBeNull();
    expect(personaPorNombre(p, undefined)).toBeNull();
  });
  it("las tareas de casa de hoy que le tocan (o son de cualquiera)", () => {
    const p = base({
      casa: [
        tarea("Areneros", { responsableId: "diego" }),
        tarea("Sábanas", { responsableId: "alba" }),
        tarea("Basura", { responsableId: null }),
        tarea("Cristales", { responsableId: "diego", desde: "2026-12-01" }),
      ],
    });
    expect(hablarDeLoQueLeToca(p, HOY, "diego")).toBe("Hoy te toca: Areneros y Basura.");
    expect(hablarDeLoQueLeToca(base(), HOY, "diego")).toBe("Hoy no te toca nada en casa.");
  });
  it("saluda según la hora y elige entre varias formas", () => {
    expect(saludoDeLaHora(8 * 60)).toBe("Buenos días");
    expect(saludoDeLaHora(16 * 60)).toBe("Buenas tardes");
    expect(saludoDeLaHora(22 * 60)).toBe("Buenas noches");
    expect(saludoDeLaHora(60)).toBe("Buenas noches");
    expect(elegir(["a", "b", "c"], 0)).toBe("a");
    expect(elegir(["a", "b", "c"], 0.99)).toBe("c");
    expect(elegir(["a", "b", "c"], 1)).toBe("c");
  });
});

describe("conchi: los datos para contestar preguntas", () => {
  it("lleva citas, cumples, casa, comidas y papeles, y nada personal", () => {
    const p = base({
      agenda: [{ fecha: "2026-11-05", hasta: null, hora: "18:00", titulo: "Pediatra" }],
      cumples: [{ nombre: "Ana", dia: 7, mes: 11, anio: 1984, personaId: "ana" }],
      casa: [tarea("Sábanas", { ultimaVez: "2026-11-14", responsableId: "diego" })],
      cenas: [{ fecha: "2026-11-03", nombre: "Pisto" }],
      mochila: [{ personaId: "alba", texto: "Piano", dias: [2], fecha: null, antes: 1 }],
    });
    const d = datosParaPreguntar(p, HOY);
    expect(d).toContain("2026-11-05 18:00: Pediatra");
    expect(d).toContain("Ana: 2026-11-07 (cumple 42 años)");
    expect(d).toContain(
      "Sábanas: cada 14 días, última vez 2026-11-14, próxima 2026-11-28, le toca a Diego",
    );
    expect(d).toContain("2026-11-03 cena: Pisto");
    expect(d).toContain("Piano (Alba)");
    expect(d.length).toBeLessThan(9001);
  });
});

describe("conchi: lo apuntado y quitado antes de abrir la app", () => {
  const e = (tipo: Entrada["tipo"], texto: string, fecha: string | null = null): Entrada => ({
    tipo,
    texto,
    fecha,
    hora: null,
  });
  it("se anula entre sí; el resto queda en orden", () => {
    const r = reducirEntradas([
      e("compra", "Leche"),
      e("pendiente", "Llamar"),
      e("quitar_compra", "leche"),
      e("compra", "Pan"),
      e("quitar_cita", "dentista", "2026-12-03"),
      e("cita", "Dentista", "2026-12-03"),
      e("quitar_pendiente", "Otra cosa"),
    ]);
    expect(r.map((x) => `${x.tipo}:${x.texto}`)).toEqual([
      "pendiente:Llamar",
      "compra:Pan",
      "quitar_cita:dentista",
      "cita:Dentista",
      "quitar_pendiente:Otra cosa",
    ]);
  });
  it("cada «quitar» anula solo una vez", () => {
    const r = reducirEntradas([
      e("compra", "Leche"),
      e("compra", "Leche"),
      e("quitar_compra", "Leche"),
    ]);
    expect(r.map((x) => x.tipo)).toEqual(["compra"]);
  });
});
