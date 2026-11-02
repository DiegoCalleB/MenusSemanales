import { describe, expect, it } from "vitest";
import { cantidadEnTexto } from "./texto";
import { enlaceWhatsApp, generarIcs, textoCompra, textoMenu } from "./compartir";

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
