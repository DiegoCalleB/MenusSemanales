import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "@/aplicacion/datos-demo";
import { type EstadoHogar, reducir } from "@/aplicacion/estado";
import {
  crearRespaldo,
  guardarRespaldoAntesDeImportar,
  guardarRespaldoAntesDeLaNube,
  leerRespaldo,
  leerRespaldosAutomaticos,
  nombreDeArchivo,
  textoDeRespaldo,
  VERSION_RESPALDO,
} from "./respaldo";

const AHORA = new Date("2026-11-02T10:30:00Z");
const con = (nombre: string, base = estadoInicialDemo()): EstadoHogar =>
  reducir(base, { tipo: "manual/anadir", nombre });
const memoria = (inicial: Record<string, string> = {}) => {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
};

describe("copia de seguridad", () => {
  it("se escribe y se vuelve a leer igual, sin avisos pasajeros", () => {
    const e = con("Algo mío");
    const r = crearRespaldo({ ...e, aviso: { id: 1, tipo: "ok", texto: "x" } }, AHORA);
    expect(r.estado.aviso).toBeNull();
    expect(nombreDeArchivo(r)).toBe("respaldo-menus-semanales-2026-11-02.json");
    const leido = leerRespaldo(textoDeRespaldo(r));
    expect(leido.ok).toBe(true);
    if (leido.ok) {
      expect(leido.respaldo.estado).toEqual({ ...e, aviso: null });
      expect(leido.respaldo.motivo).toBe("manual");
      expect(leido.respaldo.creado).toBe(AHORA.toISOString());
    }
  });

  it("rechaza lo que no es una copia de esta app, o está roto, con un motivo que se entiende", () => {
    const motivo = (t: string) => {
      const l = leerRespaldo(t);
      return l.ok ? "ok" : l.motivo;
    };
    expect(motivo("{no json")).toMatch(/no se puede leer/);
    expect(motivo("5")).toMatch(/No es un archivo/);
    expect(motivo("null")).toMatch(/No es un archivo/);
    expect(motivo(JSON.stringify({ app: "otra", version: 1, estado: {} }))).toMatch(
      /no es una copia de ¡Hecho!/,
    );
    expect(
      motivo(JSON.stringify({ app: "menus-semanales", version: VERSION_RESPALDO + 1, estado: {} })),
    ).toMatch(/más nueva/);
    expect(
      motivo(JSON.stringify({ app: "menus-semanales", version: 1, estado: { hoy: "x" } })),
    ).toMatch(/incompleto/);
    expect(motivo("x".repeat(6_000_001))).toMatch(/demasiado grande/);
  });

  it("una copia hecha antes de existir la agenda o la casa se completa al leerla", () => {
    const viejo: Partial<EstadoHogar> = { ...estadoInicialDemo() };
    delete viejo.agenda;
    delete viejo.casa;
    delete viejo.almuerzos;
    const l = leerRespaldo(
      JSON.stringify({ app: "menus-semanales", version: 1, creado: "", estado: viejo }),
    );
    expect(l.ok && l.respaldo.estado.agenda).toEqual([]);
    expect(l.ok && l.respaldo.estado.casa).toEqual([]);
    expect(l.ok && l.respaldo.estado.almuerzos).toEqual([]);
  });
});

describe("copia automática antes de que la nube sustituya lo del móvil", () => {
  it("no guarda nada si lo del móvil y lo de la nube son lo mismo (salvo «hoy»)", () => {
    const m = memoria();
    const e = con("Igual");
    expect(guardarRespaldoAntesDeLaNube(m, e, { ...e, hoy: "2030-01-01" }, AHORA)).toBe(
      "sin-cambios",
    );
    expect(leerRespaldosAutomaticos(m)).toEqual([]);
  });

  it("guarda lo del móvil si es distinto, no repite la misma y conserva las 3 últimas", () => {
    const m = memoria();
    const nube = con("De la familia");
    expect(guardarRespaldoAntesDeLaNube(m, con("Mía uno"), nube, AHORA)).toBe("guardada");
    expect(guardarRespaldoAntesDeLaNube(m, con("Mía uno"), nube, AHORA)).toBe("sin-cambios");
    for (const n of ["Mía dos", "Mía tres", "Mía cuatro"])
      guardarRespaldoAntesDeLaNube(m, con(n), nube, AHORA);
    const guardadas = leerRespaldosAutomaticos(m);
    expect(guardadas).toHaveLength(3);
    expect(guardadas.map((r) => r.estado.manuales.at(-1)?.nombre)).toEqual([
      "Mía cuatro",
      "Mía tres",
      "Mía dos",
    ]);
    expect(guardadas.every((r) => r.motivo === "antes-de-la-nube")).toBe(true);
  });

  it("nunca lanza: sin almacenamiento o sin espacio lo dice y sigue", () => {
    expect(guardarRespaldoAntesDeLaNube(null, con("A"), con("B"), AHORA)).toBe("guardada");
    const lleno = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    expect(guardarRespaldoAntesDeLaNube(lleno, con("A"), con("B"), AHORA)).toBe("no-se-pudo");
  });

  it("lo guardado roto o de otra forma se ignora al leer", () => {
    expect(
      leerRespaldosAutomaticos(memoria({ "menus-semanales:respaldos-previos": "{no" })),
    ).toEqual([]);
    expect(
      leerRespaldosAutomaticos(memoria({ "menus-semanales:respaldos-previos": '{"a":1}' })),
    ).toEqual([]);
    expect(
      leerRespaldosAutomaticos(memoria({ "menus-semanales:respaldos-previos": '["x",5]' })),
    ).toEqual([]);
    expect(leerRespaldosAutomaticos(null)).toEqual([]);
  });
});

describe("copia antes de importar a tablas", () => {
  it("guarda siempre una copia con su motivo, no repite la idéntica y no lanza si falla", () => {
    const m = memoria();
    const e = con("Para importar");
    expect(guardarRespaldoAntesDeImportar(m, e, AHORA)).toBe("guardada");
    expect(leerRespaldosAutomaticos(m)[0]?.motivo).toBe("antes-de-importar");
    expect(guardarRespaldoAntesDeImportar(m, e, AHORA)).toBe("sin-cambios");
    const roto = {
      getItem: () => null,
      setItem: () => {
        throw new Error("lleno");
      },
    };
    expect(guardarRespaldoAntesDeImportar(roto, con("Otro"), AHORA)).toBe("no-se-pudo");
  });
});
