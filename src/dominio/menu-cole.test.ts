import { describe, expect, it } from "vitest";
import { TEXTO_MENU_COLE_NOVIEMBRE_2026 } from "@/dominio/menu-cole-ejemplo";
import { aMenuCole, clasificarPlato, leerMenuCole, menuColeLeidoSchema } from "./menu-cole";

describe("clasificarPlato", () => {
  it.each([
    ["Guiso de lentejas ecológicas con zanahoria, pimiento y cebolla", "legumbre"],
    ["Macarrones ecológicos a la boloñesa de lentejas (salsa tomate)", "pasta"],
    ["Judías verdes salteadas con patata y zanahoria", "verdura"],
    ["Alubias pintas guisadas con chistorra", "legumbre"],
    ["Arroz integral a la milanesa (guisante, champiñón, lomo)", "arroz"],
    ["Cocido completo estofado (garbanzo, ternera, pollo, tocino, chorizo)", "legumbre"],
    ["Sopa de cocido con fideos integrales", "pasta"],
    ["Revuelto de pavo con patatas salteado", "huevo"],
    ["Albóndigas vegetales con salsa de tomate casera (soja)", "verdura"],
    ["Cinta de lomo a la plancha", "carne"],
    ["Bacaladilla guisada al ajoarriero", "pescado"],
    ["Crema suave de calabacín, zanahoria y calabaza", "verdura"],
  ])("%s → %s", (texto, grupo) => {
    expect(clasificarPlato(texto)).toBe(grupo);
  });

  it("devuelve null si no lo reconoce", () => {
    expect(clasificarPlato("Estofado de patatas")).toBeNull();
    expect(clasificarPlato("")).toBeNull();
  });
});

describe("leerMenuCole · menú real de noviembre de 2026", () => {
  const leido = leerMenuCole(TEXTO_MENU_COLE_NOVIEMBRE_2026);
  const dia = (f: string) => leido.dias.find((d) => d.fecha === f);

  it("detecta el mes y los 19 días con menú, sin los festivos vacíos (2 y 9)", () => {
    expect(leido.mes).toBe(11);
    expect(leido.anio).toBe(2026);
    expect(leido.dias).toHaveLength(19);
    expect(dia("2026-11-02")).toBeUndefined();
    expect(dia("2026-11-09")).toBeUndefined();
    expect(dia("2026-11-03")?.primero).toContain("Guiso de lentejas");
  });

  it("une las líneas partidas del PDF", () => {
    expect(dia("2026-11-03")?.primero).toBe(
      "Guiso de lentejas ecológicas con zanahoria, pimiento y cebolla",
    );
    expect(dia("2026-11-05")?.segundo).toBe(
      "Cocido completo estofado (garbanzo, ternera, pollo, tocino, chorizo)",
    );
    expect(dia("2026-11-13")?.primero).toBe(
      "ZUCCARONI - Macarrones ecológicos con crema de setas y dados de calabaza",
    );
  });

  it("separa primero, segundo, guarnición y postre, y descarta el pan", () => {
    expect(dia("2026-11-04")).toMatchObject({
      primero: "Crema suave de calabacín, zanahoria y calabaza",
      segundo: "Cinta de lomo a la plancha",
      guarnicion: "Patatas dado al horno",
      postre: "Fruta fresca",
      grupoPrimero: "verdura",
      grupoSegundo: "carne",
    });
    expect(dia("2026-11-06")?.postre).toBe("Yogur");
  });

  it("clasifica los grupos de la semana de la demo igual que el recomendador", () => {
    expect(dia("2026-11-05")).toMatchObject({ grupoPrimero: "pasta", grupoSegundo: "legumbre" });
    expect(dia("2026-11-06")).toMatchObject({ grupoPrimero: "arroz", grupoSegundo: "pescado" });
  });

  it("la salida cumple el esquema y todo se ha podido clasificar", () => {
    expect(menuColeLeidoSchema.safeParse(leido).success).toBe(true);
    expect(leido.avisos).toEqual([]);
  });

  it("avisa de lo que no sabe clasificar", () => {
    const r = leerMenuCole("Noviembre 2026\n3\nEstofado de patatas\nPollo asado\nKcal: 1");
    expect(r.avisos).toEqual([
      "2026-11-03: no sé clasificar «Estofado de patatas»; elige su grupo.",
    ]);
  });

  it("convierte a menú del motor", () => {
    const menu = aMenuCole(leido.dias);
    expect(menu["2026-11-04"]).toMatchObject({ primero: "verdura", segundo: "carne" });
    expect(Object.keys(menu)).toHaveLength(19);
  });
});

describe("leerMenuCole · casos límite", () => {
  it("pide el mes si no está el título y se puede dar por defecto", () => {
    const sin = leerMenuCole("3\nSopa de fideos\nPollo asado\nKcal: 1");
    expect(sin.dias).toEqual([]);
    expect(sin.avisos[0]).toContain("mes");
    const con = leerMenuCole("3\nSopa de fideos\nPollo asado\nKcal: 1", { anio: 2026, mes: 11 });
    expect(con.dias[0]).toMatchObject({
      fecha: "2026-11-03",
      grupoPrimero: "pasta",
      grupoSegundo: "carne",
    });
  });

  it("ignora días que no existen y avisa de platos sueltos", () => {
    const r = leerMenuCole(
      "Noviembre 2026\n31\nSopa de fideos\nKcal: 1\n3\nSopa de fideos\nKcal: 1",
    );
    expect(r.avisos.some((a) => a.includes("31"))).toBe(true);
    expect(r.avisos.some((a) => a.includes("2026-11-03") && a.includes("solo"))).toBe(true);
  });

  it("un texto sin menús avisa", () => {
    expect(leerMenuCole("Noviembre 2026\nhola").avisos).toContain(
      "No he encontrado ningún día con menú en el texto.",
    );
  });
});
