import { describe, expect, it } from "vitest";
import { MAX_CONTEXTO } from "@/dominio/ia-preguntar";
import { estadoInicialDemo } from "./datos-demo";
import { reducir } from "./estado";
import { contextoParaPreguntar } from "./preguntar";

function conDatos() {
  let e = estadoInicialDemo();
  const alba = e.personas.find((p) => p.nombre === "Alba")!;
  e = reducir(e, {
    tipo: "agenda/cita",
    fecha: "2026-11-06",
    hora: "18:00",
    titulo: "Pediatra de Alba",
  });
  e = reducir(e, {
    tipo: "vencimiento/guardar",
    titulo: "Pasaporte",
    categoria: "documentos",
    personaId: alba.id,
    fecha: "2027-03-10",
    repiteMeses: 60,
    avisos: [30],
    notas: "Pedir cita previa",
  });
  e = reducir(e, {
    tipo: "pendiente/anadir",
    texto: "Llamar al fontanero",
    personaId: null,
    importante: true,
  });
  e = reducir(e, {
    tipo: "medicacion/guardar",
    personaId: alba.id,
    nombre: "Medicina secreta",
    hora: 21,
    dias: [1, 2, 3],
  });
  e = { ...e, notasMenu: { [e.hoy]: "nota privada del menú" } };
  return e;
}

describe("el resumen para preguntar a la casa (D-179)", () => {
  it("lleva lo que se suele preguntar: citas, papeles con de quién son, pendientes y la compra", () => {
    const t = contextoParaPreguntar(conDatos());
    expect(t).toContain("## Citas");
    expect(t).toContain("Pediatra de Alba");
    expect(t).toContain("a las 18:00");
    expect(t).toContain("Pasaporte de Alba");
    expect(t).toContain("Pedir cita previa");
    expect(t).toContain("(importante) Llamar al fontanero");
    expect(t).toContain("## Lista de la compra");
  });

  it("nunca lleva la medicación ni las notas del menú", () => {
    const t = contextoParaPreguntar(conDatos());
    expect(t).not.toContain("Medicina secreta");
    expect(t).not.toMatch(/medicaci/i);
    expect(t).not.toContain("nota privada");
  });

  it("no pasa del tamaño máximo y sin datos queda corto", () => {
    expect(contextoParaPreguntar(conDatos()).length).toBeLessThanOrEqual(MAX_CONTEXTO);
    let e = conDatos();
    for (let i = 0; i < 150; i++) {
      e = reducir(e, {
        tipo: "pendiente/anadir",
        texto: `Pendiente número ${i} con un texto bastante largo para llenar`,
        personaId: null,
        importante: false,
      });
    }
    expect(contextoParaPreguntar(e).length).toBeLessThanOrEqual(MAX_CONTEXTO);
  });
});
