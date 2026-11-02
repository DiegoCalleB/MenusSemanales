import { describe, expect, it } from "vitest";
import { validarPlato } from "@/dominio/catalogo";
import { calcularCompra } from "@/dominio/compra";
import { catalogoOrdenado, cumplesProximos, explicacionDe } from "./estado";
import { opcionesParaFecha } from "./estado";
import { type Accion, type EstadoHogar, articulosPendientes, diasDelMenu, reducir } from "./estado";
import { estadoModoDiego, FECHA_CUMPLE_ANA } from "./datos-diego";

const aplicar = (e: EstadoHogar, ...a: Accion[]) => a.reduce(reducir, e);
const DOMINGO = "2026-11-01";

describe("modo Diego: datos reales de la familia", () => {
  const e = estadoModoDiego(DOMINGO);

  it("la familia: Diego, Ana, Alba (9) y Emma (5)", () => {
    expect(e.personas.map((p) => p.nombre)).toEqual(["Diego", "Ana", "Alba", "Emma"]);
    expect(e.personas.filter((p) => p.tipo === "nino").map((p) => p.nombre)).toEqual([
      "Alba",
      "Emma",
    ]);
  });

  it("todos los platos son válidos según las reglas del catálogo y están marcados por revisar", () => {
    const ids = new Set(e.ingredientes.map((i) => i.id));
    expect(e.platos.length).toBeGreaterThanOrEqual(50);
    for (const p of e.platos) {
      const r = validarPlato({ ...p, pasos: p.pasos ?? null }, ids);
      expect(r.ok, `${p.nombre}: ${r.ok ? "" : r.errores.join(", ")}`).toBe(true);
      expect(p.porRevisar).toBe(true);
    }
    expect(new Set(e.platos.map((p) => p.id)).size).toBe(e.platos.length);
  });

  it("incluye los platos que Diego listó en sus capturas", () => {
    const nombres = e.platos.map((p) => p.nombre);
    for (const esperado of [
      "Arroz con pollo al curry",
      "Hamburguesas de ternera",
      "Solomillo con bacon y queso",
      "Cocido",
      "Costillas barbacoa",
      "Crema de calabaza",
      "Tortilla de patatas",
      "Pizza casera",
    ]) {
      expect(nombres).toContain(esperado);
    }
  });

  it("tiene el menú real del cole de noviembre y el cumpleaños de Ana", () => {
    expect(Object.keys(e.colegio)).toHaveLength(19);
    expect(e.colegio["2026-11-03"]).toMatchObject({ primero: "legumbre", segundo: "huevo" });
    expect(e.eventos[FECHA_CUMPLE_ANA]?.titulo).toBe("Cumpleaños de Ana");
    expect(e.turnos).toEqual([
      { cargaId: "cenas", fecha: FECHA_CUMPLE_ANA, personaId: "diego", estado: "pendiente" },
    ]);
  });

  it("un domingo, la «semana» es la que empieza mañana", () => {
    const dias = diasDelMenu(e).map((d) => d.fecha);
    expect(dias[0]).toBe("2026-11-02");
    expect(dias.at(-1)).toBe("2026-11-08");
  });

  it("proponer la semana rellena de martes a viernes: 4 cenas que respetan cole, tiempo y no repiten", () => {
    const p = aplicar(e, { tipo: "menu/autocompletar" });
    const cenas = p.comidas.map((c) => c.fecha);
    expect(cenas).toEqual(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(p.comidas.some((c) => c.fecha === "2026-11-02")).toBe(false); // lunes saltado
    expect(p.comidas.some((c) => c.fecha === FECHA_CUMPLE_ANA)).toBe(false); // el cumple se decide a mano
    expect(new Set(p.comidas.map((c) => c.plato.id)).size).toBe(4);
    for (const c of p.comidas) {
      const plato = p.platos.find((x) => x.id === c.plato.id);
      expect(plato?.minutosActivos).toBeLessThanOrEqual(30);
    }
    // Con las 4 cenas hay lista de la compra (la despensa de ejemplo está vacía).
    expect(articulosPendientes(p).length).toBeGreaterThan(2);
  });

  it("repetir «proponer» no cambia lo ya elegido y avisa si no queda nada por rellenar", () => {
    const p = aplicar(e, { tipo: "menu/autocompletar" });
    const otra = aplicar(p, { tipo: "menu/autocompletar" });
    expect(otra.comidas).toEqual(p.comidas);
    expect(otra.aviso?.tipo).toBe("error");
  });

  it("saltar un día quita su cena y lo excluye de «proponer»", () => {
    const p = aplicar(
      e,
      { tipo: "menu/autocompletar" },
      { tipo: "menu/saltar", fecha: "2026-11-05" },
    );
    expect(p.comidas.some((c) => c.fecha === "2026-11-05")).toBe(false);
    expect(
      aplicar(p, { tipo: "menu/autocompletar" }).comidas.some((c) => c.fecha === "2026-11-05"),
    ).toBe(false);
    // Volver a incluir el día permite proponer de nuevo.
    const de_nuevo = aplicar(
      p,
      { tipo: "menu/saltar", fecha: "2026-11-05" },
      { tipo: "menu/autocompletar" },
    );
    expect(de_nuevo.comidas.some((c) => c.fecha === "2026-11-05")).toBe(true);
  });

  it("explica por qué recomienda cada cena con el cole y el equilibrio de la semana", () => {
    const p = aplicar(e, { tipo: "menu/autocompletar" });
    const opcion = opcionesParaFecha(p, "2026-11-04")[0];
    expect(opcion).toBeDefined();
    const ex = explicacionDe(p, "2026-11-04", opcion as NonNullable<typeof opcion>);
    expect(ex.resumen).toContain("verdura y carne en el cole");
    expect(ex.lineas.some((l) => l.startsWith("Encaja con el cole"))).toBe(true);
    expect(ex.lineas.some((l) => l.includes("Esta semana llevan"))).toBe(true);
  });

  it("la propuesta usa platos principales y los pequeños se ofrecen como complemento", () => {
    const p = aplicar(e, { tipo: "menu/autocompletar" });
    for (const c of p.comidas) expect((c.plato as { ligero?: boolean }).ligero).toBeFalsy();
    const martes = "2026-11-03";
    const ops = opcionesParaFecha(p, martes, true);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.some((o) => o.plato.ligero)).toBe(true);
    expect(ops[0]?.plato.ligero).toBe(true);
    const con = aplicar(p, { tipo: "menu/anadir", fecha: martes, platoId: ops[0]?.plato.id ?? "" });
    expect(con.comidas.filter((c) => c.fecha === martes)).toHaveLength(2);
  });

  it("trae las tareas de la lista que escribió Ana: rutinas de las niñas y tareas de cada uno", () => {
    const de = (id: string) => e.tareas.filter((t) => t.personaId === id).map((t) => t.texto);
    expect(de("emma")).toEqual([
      "Dientes",
      "Vestir",
      "Hacer cama",
      "Recoger habitación",
      "Recoger manualidades",
    ]);
    expect(de("alba")).toEqual([
      "Dientes",
      "Vestir",
      "Hacer cama",
      "Limpiar botella",
      "Recoger manualidades",
      "Deberes",
      "Examen",
    ]);
    expect(de("diego")).toContain("Bajar sillas");
    expect(de("ana")).toEqual(["Halloween", "Ropa", "Habitación", "Cocina"]);
    expect(e.tareas.filter((t) => t.frecuencia === "diaria").map((t) => t.texto)).toContain(
      "Hacer cama",
    );
    expect(new Set(e.tareas.map((t) => t.id)).size).toBe(e.tareas.length);
  });

  it("el catálogo completo de un día: encajan primero, el resto con su motivo", () => {
    const todos = catalogoOrdenado(e, "2026-11-04"); // cole: verdura + carne
    expect(todos.length).toBe(e.platos.length);
    const primerNoCompatible = todos.findIndex((o) => !o.compatible);
    expect(primerNoCompatible).toBeGreaterThan(0);
    expect(todos.slice(0, primerNoCompatible).every((o) => o.compatible)).toBe(true);
    expect(
      todos.slice(primerNoCompatible).every((o) => !o.compatible && o.rechazos.length > 0),
    ).toBe(true);
    // Tras verdura y carne en el cole, una hamburguesa (carne) no encaja y lo dice.
    const burger = todos.find((o) => o.plato.id === "hamburguesas-ternera");
    expect(burger?.rechazos.some((r) => r.tipo === "cole")).toBe(true);
    expect(catalogoOrdenado(e, "2027-06-01")).toEqual([]); // fuera de plazo
  });

  it("los cumpleaños de la familia ya están y el de Ana avisa a menos de un mes", () => {
    expect(e.cumples.map((c) => [c.nombre, c.dia, c.mes, c.anio])).toEqual([
      ["Ana", 7, 11, 1984],
      ["Diego", 3, 1, 1985],
      ["Alba", 4, 2, 2017],
      ["Emma", 24, 6, 2021],
    ]);
    const avisos = cumplesProximos(e);
    expect(avisos).toHaveLength(1); // los demás quedan a más de un mes
    expect(avisos[0]).toMatchObject({ dias: 6, urgencia: "esta-semana", edad: 42 });
  });

  it("«hoy» se puede actualizar a la fecha real", () => {
    expect(reducir(e, { tipo: "hogar/hoy", fecha: "2026-11-02" }).hoy).toBe("2026-11-02");
    expect(reducir(e, { tipo: "hogar/hoy", fecha: DOMINGO })).toBe(e);
  });

  it("la compra no inventa despensa: todo lo de las cenas está por comprar", () => {
    const p = aplicar(e, { tipo: "menu/autocompletar" });
    const compra = calcularCompra({
      comidas: p.comidas,
      despensa: p.despensa,
      ingredientes: new Map(p.ingredientes.map((i) => [i.id, i])),
      hoy: p.hoy,
    });
    expect(compra.length).toBeGreaterThan(0);
  });
});
