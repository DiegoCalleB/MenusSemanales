import { describe, expect, it } from "vitest";
import { AVISO_CAMBIO, TEXTO_RIESGO, peorEstado, riesgoDeGuardado } from "./guardado";

const s = (
  fase: string,
  sync: "al-dia" | "error" | "sin-conexion" | "guardando" | "inactivo",
  nube = true,
) => ({
  nubeConfigurada: nube,
  fase,
  sync,
});

describe("riesgoDeGuardado", () => {
  it("sin la nube configurada (uso local a propósito) no avisa", () => {
    expect(riesgoDeGuardado(s("sin-configurar", "inactivo", false))).toBeNull();
  });

  it("con la nube configurada, cualquier fase que no sea «conectado» avisa", () => {
    expect(riesgoDeGuardado(s("sin-sesion", "inactivo"))).toBe("sin-sesion");
    expect(riesgoDeGuardado(s("sin-hogar", "inactivo"))).toBe("sin-hogar");
    expect(riesgoDeGuardado(s("sin-configurar", "inactivo"))).toBe("sin-sesion");
  });

  it("mientras arranca no es un fallo", () => {
    expect(riesgoDeGuardado(s("cargando", "inactivo"))).toBeNull();
  });

  it("conectado: avisa de error y de falta de conexión, y no de lo demás", () => {
    expect(riesgoDeGuardado(s("conectado", "error"))).toBe("error");
    expect(riesgoDeGuardado(s("conectado", "sin-conexion"))).toBe("sin-conexion");
    expect(riesgoDeGuardado(s("conectado", "al-dia"))).toBeNull();
    expect(riesgoDeGuardado(s("conectado", "guardando"))).toBeNull();
  });

  it("sin internet en el móvil avisa al instante, antes de intentar guardar", () => {
    expect(riesgoDeGuardado({ ...s("conectado", "al-dia"), enLinea: false })).toBe("sin-conexion");
    expect(riesgoDeGuardado({ ...s("conectado", "al-dia"), enLinea: true })).toBeNull();
  });

  it("todos los riesgos tienen su texto de franja y su aviso por cambio", () => {
    for (const r of ["sin-sesion", "sin-hogar", "sin-conexion", "error"] as const) {
      expect(TEXTO_RIESGO[r].length).toBeGreaterThan(10);
      expect(AVISO_CAMBIO[r]).toContain("⚠️");
    }
  });
});

describe("peorEstado", () => {
  it("elige el más grave", () => {
    expect(peorEstado("al-dia", "error", "guardando")).toBe("error");
    expect(peorEstado("al-dia", "sin-conexion")).toBe("sin-conexion");
    expect(peorEstado("inactivo", "al-dia")).toBe("al-dia");
    expect(peorEstado()).toBe("inactivo");
  });
});
