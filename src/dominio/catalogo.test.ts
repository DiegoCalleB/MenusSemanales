import { describe, expect, it } from "vitest";
import { avisosDePlato, ingredienteNuevoSchema, normalizarNombre, validarPlato } from "./catalogo";

const conocidos = new Set(["huevo", "patata"]);
const valido = {
  nombre: "Tortilla",
  grupo: "huevo",
  minutosActivos: 20,
  pasos: null,
  ingredientes: [{ ingredienteId: "huevo", cantidadPorRacion: 2, opcional: false }],
};

describe("validarPlato", () => {
  it("acepta un plato correcto y recorta el nombre", () => {
    const r = validarPlato({ ...valido, nombre: "  Tortilla  " }, conocidos);
    expect(r.ok && r.valor.nombre).toBe("Tortilla");
  });

  it.each([
    [{ nombre: "a" }, "El nombre necesita al menos 2 letras"],
    [{ minutosActivos: 0 }, "Mínimo 1 minuto"],
    [{ minutosActivos: 241 }, "Máximo 240 minutos"],
    [{ minutosActivos: 2.5 }, "Los minutos deben ser un número entero"],
    [{ grupo: "dulce" }, undefined],
    [{ ingredientes: [] }, "Añade al menos un ingrediente"],
    [{ pasos: "x".repeat(4001) }, "Los pasos son demasiado largos"],
  ])("rechaza %j", (cambio, mensaje) => {
    const r = validarPlato({ ...valido, ...cambio }, conocidos);
    expect(r.ok).toBe(false);
    if (!r.ok && mensaje) expect(r.errores).toContain(mensaje);
  });

  it("rechaza ingredientes desconocidos, repetidos o cantidades no positivas", () => {
    const ing = (id: string, c = 1, opcional = false) => ({
      ingredienteId: id,
      cantidadPorRacion: c,
      opcional,
    });
    const e = (ingredientes: unknown[]) => {
      const r = validarPlato({ ...valido, ingredientes }, conocidos);
      return r.ok ? [] : r.errores;
    };
    expect(e([ing("nada")])).toContain("Hay un ingrediente que no existe");
    expect(e([ing("huevo"), ing("huevo")])).toContain("Un ingrediente está repetido");
    expect(validarPlato({ ...valido, ingredientes: [ing("huevo", 0)] }, conocidos).ok).toBe(false);
    expect(e([ing("huevo", 1, true)])).toContain("Al menos un ingrediente debe ser obligatorio");
  });

  it("rechaza valores que no son un objeto", () => {
    expect(validarPlato(null, conocidos).ok).toBe(false);
  });
});

describe("avisosDePlato", () => {
  it("avisa de sin pasos, tiempo alto y enlaces; un plato bueno no tiene avisos", () => {
    expect(avisosDePlato({ pasos: null, minutosActivos: 20 })).toHaveLength(1);
    expect(avisosDePlato({ pasos: "  ", minutosActivos: 60 })).toHaveLength(2);
    expect(avisosDePlato({ pasos: "Mira https://x.com", minutosActivos: 20 })[0]).toContain(
      "enlace",
    );
    expect(avisosDePlato({ pasos: "Bate los huevos y cuaja.", minutosActivos: 20 })).toEqual([]);
  });
});

describe("ingredientes nuevos y nombres", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(normalizarNombre("  Pechuga   de  POLLO ")).toBe("pechuga de pollo");
    expect(normalizarNombre("Calabacín")).toBe("calabacin");
  });

  it("valida el ingrediente nuevo", () => {
    expect(
      ingredienteNuevoSchema.safeParse({ nombre: "Lima", unidad: "ud", seccion: "fruta_verdura" })
        .success,
    ).toBe(true);
    expect(
      ingredienteNuevoSchema.safeParse({ nombre: "L", unidad: "ud", seccion: "otros" }).success,
    ).toBe(false);
    expect(
      ingredienteNuevoSchema.safeParse({ nombre: "Lima", unidad: "kg", seccion: "otros" }).success,
    ).toBe(false);
  });
});
