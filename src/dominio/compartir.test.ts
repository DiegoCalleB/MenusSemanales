import { describe, expect, it } from "vitest";
import { cantidadEnTexto } from "./texto";
import {
  enlaceWhatsApp,
  generarIcs,
  textoCasa,
  textoCompra,
  textoFechas,
  textoMenu,
} from "./compartir";

const dias = [
  {
    fecha: "2026-11-03",
    etiqueta: "Martes 3",
    cole: "🫘 🍳",
    platos: ["Filetes de ternera"],
    evento: null,
  },
  { fecha: "2026-11-04", etiqueta: "Miércoles 4", cole: "", platos: [], evento: null },
  {
    fecha: "2026-11-07",
    etiqueta: "Sábado 7",
    cole: "",
    platos: ["Pizza casera", "Ensalada"],
    evento: { emoji: "🎂", titulo: "Cumpleaños de Ana" },
  },
];

describe("texto del menú para WhatsApp", () => {
  const t = textoMenu("Menú del 3 al 7 de noviembre", dias);
  it("lleva título en negrita, días, cole, platos juntos y sin decidir", () => {
    expect(t).toContain("🍽️ *Menú del 3 al 7 de noviembre*");
    expect(t).toContain("*Martes 3*  🎒 🫘 🍳");
    expect(t).toContain("🍴 Filetes de ternera");
    expect(t).toContain("🍴 _sin decidir_");
    expect(t).toContain("🍴 Pizza casera + Ensalada");
    expect(t).toContain("🎂 Cumpleaños de Ana");
    expect(t.endsWith("_Hecho con Menús Semanales_")).toBe(true);
  });
  it("no pasa del límite aunque haya muchísimos días", () => {
    const muchos = Array.from({ length: 400 }, (_, i) => ({ ...dias[0]!, etiqueta: `Día ${i}` }));
    const largo = textoMenu("x", muchos);
    expect(largo.length).toBeLessThanOrEqual(3800);
    expect(largo.endsWith("(recortado)")).toBe(true);
  });
});

describe("texto de la lista de la compra", () => {
  it("agrupa por sección con casillas y añade lo manual", () => {
    const t = textoCompra(
      [
        { nombre: "Fruta y verdura", emoji: "🥦", lineas: ["Tomate · 300 g", "Calabacín · 1 kg"] },
        { nombre: "Carne", emoji: "🥩", lineas: [] },
      ],
      ["Papel de cocina"],
    );
    expect(t).toContain("🛒 *Lista de la compra*");
    expect(t).toContain("🥦 *Fruta y verdura*\n☐ Tomate · 300 g\n☐ Calabacín · 1 kg");
    expect(t).not.toContain("Carne"); // sección vacía
    expect(t).toContain("📝 *Otros*\n☐ Papel de cocina");
  });
  it("si no falta nada, lo dice", () => {
    expect(textoCompra([], [])).toContain("No falta nada 🎉");
  });
  it("formatea cantidades y construye el enlace de WhatsApp codificado", () => {
    expect(cantidadEnTexto(1500, "g")).toBe("1,5 kg");
    expect(cantidadEnTexto(250, "ml")).toBe("250 ml");
    expect(cantidadEnTexto(3, "ud")).toBe("3 ud");
    expect(enlaceWhatsApp("hola & adiós\n🍽️")).toBe(
      "https://wa.me/?text=hola%20%26%20adi%C3%B3s%0A%F0%9F%8D%BD%EF%B8%8F",
    );
  });
});

describe("archivo de calendario", () => {
  const ics = generarIcs(
    "Cenas; de, casa",
    [
      {
        fecha: "2026-11-30",
        titulo: "🍽️ Cena: Tortilla, ensalada",
        descripcion: "Línea 1\nLínea 2; con coma, y \\ barra",
      },
    ],
    new Date("2026-11-02T10:20:30.123Z"),
  );
  it("tiene la estructura mínima, fin de día siguiente y saltos de línea CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130");
    expect(ics).toContain("DTEND;VALUE=DATE:20261201"); // pasa de mes
    expect(ics).toContain("DTSTAMP:20261102T102030Z");
    expect(ics).toContain("UID:20261130-0@menus-semanales");
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });
  it("un evento anual lleva su regla de repetición", () => {
    const anual = generarIcs(
      "x",
      [{ fecha: "2026-11-07", titulo: "🎂 Cumple de Ana", descripcion: "", anual: true }],
      new Date(0),
    );
    expect(anual).toContain("RRULE:FREQ=YEARLY");
    expect(ics).not.toContain("RRULE");
  });
  it("un evento con aviso lleva una alarma a las 9:00 del propio día", () => {
    const con = generarIcs(
      "x",
      [{ fecha: "2026-11-07", titulo: "Pensar", descripcion: "d", aviso: true }],
      new Date(0),
    );
    expect(con).toContain("BEGIN:VALARM\r\nACTION:DISPLAY");
    expect(con).toContain("TRIGGER:PT9H");
    expect(ics).not.toContain("VALARM");
  });
  it("escapa comas, puntos y coma, barras y saltos de línea", () => {
    expect(ics).toContain("X-WR-CALNAME:Cenas\; de\\, casa");
    expect(ics).toContain("SUMMARY:🍽️ Cena: Tortilla\\, ensalada");
    expect(ics).toContain("Línea 1\\nLínea 2\; con coma\\, y \\\\ barra");
  });
  it("pliega líneas largas a 75 bytes como máximo sin partir emojis", () => {
    const largo = generarIcs(
      "x",
      [{ fecha: "2026-11-03", titulo: "t", descripcion: "🍽️".repeat(60) }],
      new Date(0),
    );
    for (const linea of largo.split("\r\n"))
      expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
    const desplegado = largo.replace(/\r\n /g, "");
    expect(desplegado).toContain("🍽️".repeat(60));
  });
});

describe("generarIcs: apuntes con hora y de varios días", () => {
  const ahora = new Date("2026-11-02T10:00:00Z");
  it("con hora dura una hora y avisa una hora antes; de varios días cuenta el último completo", () => {
    const ics = generarIcs(
      "x",
      [
        { fecha: "2026-11-05", titulo: "Psico", descripcion: "Psico", hora: "18:15", aviso: true },
        { fecha: "2026-11-17", titulo: "Puente", descripcion: "Puente", hasta: "2026-11-19" },
        { fecha: "2026-11-06", titulo: "Tarde", descripcion: "Tarde", hora: "23:30" },
      ],
      ahora,
    );
    expect(ics).toContain("DTSTART:20261105T181500");
    expect(ics).toContain("DTEND:20261105T191500");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261117");
    expect(ics).toContain("DTEND;VALUE=DATE:20261120");
    expect(ics).toContain("DTEND:20261106T235900");
  });
});

describe("compartir: comidas, fechas y lo que toca en casa", () => {
  it("el menú incluye la comida del mediodía y distingue la cena cuando hay las dos", () => {
    const t = textoMenu("Menú del 7 al 8 de noviembre", [
      {
        fecha: "2026-11-07",
        etiqueta: "Sábado 7",
        cole: "",
        platos: ["Pizza casera"],
        comida: ["Paella", "Ensalada"],
        evento: null,
      },
      {
        fecha: "2026-11-08",
        etiqueta: "Domingo 8",
        cole: "",
        platos: [],
        comida: ["Por decidir"],
        evento: null,
      },
      { fecha: "2026-11-09", etiqueta: "Lunes 9", cole: "", platos: ["Sopa"], evento: null },
    ]);
    expect(t).toContain("☀️ Comida: Paella + Ensalada");
    expect(t).toContain("🍴 Cena: Pizza casera");
    expect(t).toContain("☀️ Comida: Por decidir");
    expect(t).toContain("🍴 _cena sin decidir_");
    // Sin comida, la cena sale como siempre (sin «Cena:»).
    expect(t).toContain("🍴 Sopa");
    expect(t).not.toContain("Cena: Sopa");
  });

  it("las próximas fechas se leen de una vez, con la hora y el «cuándo»", () => {
    const t = textoFechas([
      { etiqueta: "sáb 7 nov", emoji: "🎂", titulo: "Ana (42)", hora: null, cuando: "en 5 días" },
      {
        etiqueta: "jue 12 nov",
        emoji: "📌",
        titulo: "Psicotécnico",
        hora: "18:15",
        cuando: "en 10 días",
      },
    ]);
    expect(t).toContain("📌 *Próximas fechas*");
    expect(t).toContain("*sáb 7 nov* · 🎂 Ana (42) _(en 5 días)_");
    expect(t).toContain("*jue 12 nov* 18:15 · 📌 Psicotécnico");
    expect(textoFechas([])).toContain("Nada apuntado");
  });

  it("lo que toca en casa va agrupado por quién lo lleva, sin repetir el nombre", () => {
    const t = textoCasa([
      { emoji: "🛏️", titulo: "Cambiar sábanas", quien: "Diego", cuando: "hoy" },
      { emoji: "🐱", titulo: "Limpiar areneros", quien: "Los dos", cuando: "desde hace 2 días" },
      { emoji: "🛁", titulo: "Cambiar toallas", quien: "Diego", cuando: "en 3 días" },
    ]);
    expect(t.match(/\*Diego\*/g)).toHaveLength(1);
    expect(t).toContain("☐ 🛏️ Cambiar sábanas _(hoy)_");
    expect(t).toContain("*Los dos*\n☐ 🐱 Limpiar areneros _(desde hace 2 días)_");
    expect(textoCasa([])).toContain("Nada pendiente");
  });
});
