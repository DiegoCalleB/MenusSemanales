import { afterEach, describe, expect, it, vi } from "vitest";
import { type CalendarioLeido, hayCole, registrarCursos } from "@/dominio/calendario-escolar";
import {
  type Dependencias,
  comprobarCalendarioEscolar,
  cursosAComprobar,
  resumenDeComprobacion,
} from "./comprobar-calendario-escolar";

/** La comprobación mensual del calendario escolar (D-146), con la web y la IA de mentira. */
const HTML = `<a href="/docs/2027-06/bocm-orden-calendario-escolar-curso-2027-28.pdf">Orden</a>
<a href="/docs/2027-06/calendario-escolar_27-28.pdf">Cuadro</a>`;

const BUENO: CalendarioLeido = {
  inicio: "2027-09-08",
  fin: "2028-06-20",
  periodos: [
    { desde: "2027-12-23", hasta: "2028-01-07", motivo: "Vacaciones de Navidad" },
    { desde: "2028-04-08", hasta: "2028-04-16", motivo: "Semana Santa" },
  ],
  dias: [
    { fecha: "2027-10-12", motivo: "Fiesta Nacional" },
    { fecha: "2027-11-01", motivo: "Todos los Santos" },
    { fecha: "2027-12-06", motivo: "Constitución" },
    { fecha: "2027-12-08", motivo: "Inmaculada" },
  ],
};

function deps(cambios: Partial<Dependencias> = {}): Dependencias {
  return {
    hoy: "2027-07-01",
    pagina: async () => HTML,
    pdf: async () => "JVBERi0=",
    leer: async () => BUENO,
    guardar: vi.fn(async () => "nuevo"),
    huella: () => "f".repeat(64),
    ...cambios,
  };
}

afterEach(() => registrarCursos([]));

describe("comprobar el calendario escolar cada mes (D-146)", () => {
  it("mira el curso siguiente al último conocido", () => {
    expect(cursosAComprobar("2026-11-14")).toEqual([2027]);
  });

  it("publicado, leído igual dos veces y válido: se guarda", async () => {
    const d = deps();
    const r = await comprobarCalendarioEscolar(d);
    expect(r).toEqual([expect.objectContaining({ anio: 2027, estado: "nuevo" })]);
    expect(d.guardar).toHaveBeenCalledTimes(1);
    expect(resumenDeComprobacion(r)).toBe("Curso 2027/2028: cargado");
    // Y una vez registrado, la app ya lo usa.
    if (r[0]?.estado === "nuevo") registrarCursos([r[0].curso]);
    expect(hayCole("2027-09-07", [])).toBe(false);
    expect(hayCole("2027-11-09", [])).toBe(false); // la Almudena, martes
    expect(hayCole("2027-11-10", [])).toBe(true);
  });

  it("si aún no está la orden, no hace nada", async () => {
    const d = deps({ pagina: async () => "<p>nada</p>" });
    expect(await comprobarCalendarioEscolar(d)).toEqual([{ anio: 2027, estado: "sin-publicar" }]);
    expect(d.guardar).not.toHaveBeenCalled();
  });

  it("si las dos lecturas no coinciden, no se guarda", async () => {
    let n = 0;
    const d = deps({
      leer: async () =>
        n++ === 0
          ? BUENO
          : { ...BUENO, dias: [...BUENO.dias, { fecha: "2028-02-11", motivo: "X" }] },
    });
    expect((await comprobarCalendarioEscolar(d))[0]?.estado).toBe("lecturas-distintas");
    expect(d.guardar).not.toHaveBeenCalled();
  });

  it("si lo leído no cuadra (sin Semana Santa, otro curso), no se guarda", async () => {
    const sinSemanaSanta = deps({
      leer: async () => ({ ...BUENO, periodos: [BUENO.periodos[0]!] }),
    });
    const r = await comprobarCalendarioEscolar(sinSemanaSanta);
    expect(r[0]).toMatchObject({ estado: "no-valido" });
    expect(sinSemanaSanta.guardar).not.toHaveBeenCalled();
    const otro = deps({ leer: async () => ({ ...BUENO, inicio: "2026-09-07" }) });
    expect((await comprobarCalendarioEscolar(otro))[0]).toMatchObject({ estado: "no-valido" });
  });

  it("sin PDF, sin IA o con la web caída, nada se rompe", async () => {
    expect((await comprobarCalendarioEscolar(deps({ pdf: async () => null })))[0]?.estado).toBe(
      "sin-descargar",
    );
    expect((await comprobarCalendarioEscolar(deps({ leer: async () => null })))[0]?.estado).toBe(
      "no-leido",
    );
    const caida = deps({
      pagina: async () => {
        throw new Error("x");
      },
    });
    expect((await comprobarCalendarioEscolar(caida))[0]?.estado).toBe("sin-descargar");
    const ia = deps({
      leer: async () => {
        throw new Error("ia");
      },
    });
    expect((await comprobarCalendarioEscolar(ia))[0]?.estado).toBe("fallo");
  });
});
