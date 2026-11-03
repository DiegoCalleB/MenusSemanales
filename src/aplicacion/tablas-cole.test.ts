import { describe, expect, it } from "vitest";
import { estadoModoDiego } from "./datos-diego";
import { estadoInicialDemo } from "./datos-demo";
import { type EstadoHogar } from "./estado";
import { adaptadorCole } from "./adaptadores-tablas";
import { SincronizadorTablas, type NubeTablas } from "./sincronizacion-tablas";
import {
  type CambiosCole,
  type LecturaCole,
  aplicarCambiosALecturaCole,
  aplicarLecturaDeCole,
  cambiosCompletosCole,
  diferenciasCole,
  hayColeEnTablas,
  leerCole,
  lecturaDeCole,
} from "./tablas-cole";

const diego = () => estadoModoDiego("2026-11-01");
const vacia: LecturaCole = { centro: null, dias: [] };

describe("menú del cole en tablas", () => {
  it("el menú real del cole (19 días) se escribe y se lee idéntico", () => {
    const e = diego();
    const dias = Object.keys(e.colegio);
    expect(dias.length).toBeGreaterThan(10);
    const lectura = aplicarCambiosALecturaCole(vacia, cambiosCompletosCole(e));
    expect(lectura.centro?.nombre).toBe("Colegio");
    expect(lectura.dias).toHaveLength(dias.length);
    const leido = aplicarLecturaDeCole({ ...e, colegio: {} }, JSON.parse(JSON.stringify(lectura)));
    for (const f of dias) {
      const a = e.colegio[f as keyof typeof e.colegio]!;
      const b = leido.colegio[f as keyof typeof e.colegio]!;
      expect(b.primero).toBe(a.primero);
      expect(b.segundo).toBe(a.segundo);
      expect(b.textoPrimero ?? null).toBe(a.textoPrimero ?? null);
      expect(b.textoSegundo ?? null).toBe(a.textoSegundo ?? null);
      expect(b.postre ?? null).toBe(a.postre ?? null);
      expect(b.guarnicion ?? null).toBe(a.guarnicion ?? null);
      expect(b.kcal ?? null).toBe(a.kcal ?? null);
    }
  });

  it("un día que solo trae el tipo de plato se guarda con su nombre y vuelve sin texto inventado", () => {
    const e: EstadoHogar = {
      ...estadoInicialDemo(),
      colegio: { "2026-11-10": { primero: "arroz", segundo: null } },
    };
    const c = cambiosCompletosCole(e);
    expect(c.dias?.upsert?.[0]).toMatchObject({
      primero: "arroz",
      grupoPrimero: "arroz",
      segundo: null,
    });
    const leido = aplicarLecturaDeCole(e, aplicarCambiosALecturaCole(vacia, c));
    expect(leido.colegio["2026-11-10"]).toMatchObject({ primero: "arroz", textoPrimero: null });
  });

  it("un día sin nada no se guarda y los textos largos se recortan", () => {
    const e: EstadoHogar = {
      ...estadoInicialDemo(),
      colegio: {
        "2026-11-10": { primero: null, segundo: null },
        "2026-11-11": {
          primero: "pasta",
          segundo: null,
          textoPrimero: "x".repeat(300),
          kcal: 99999,
        },
      },
    };
    const c = cambiosCompletosCole(e);
    expect(c.dias?.upsert).toHaveLength(1);
    expect(c.dias?.upsert?.[0]?.primero).toHaveLength(200);
    expect(c.dias?.upsert?.[0]?.kcal).toBeNull();
  });

  it("diferencias: solo lo que cambió, altas y bajas por fecha", () => {
    const a = diego();
    expect(diferenciasCole(a, a)).toBeNull();
    const [f1, f2] = Object.keys(a.colegio) as Array<keyof typeof a.colegio>;
    const cambiado: EstadoHogar = {
      ...a,
      colegio: { ...a.colegio, [f1!]: { ...a.colegio[f1!]!, textoPrimero: "Otra cosa" } },
    };
    expect(diferenciasCole(a, cambiado)?.dias?.upsert).toHaveLength(1);
    const sin = { ...a.colegio };
    delete sin[f2!];
    expect(diferenciasCole(a, { ...a, colegio: sin })?.dias?.borrar).toEqual([f2]);
  });

  it("formato inesperado y lectura vacía", () => {
    expect(() => leerCole({ dias: "no" })).toThrow();
    expect(hayColeEnTablas(vacia)).toBe(false);
    expect(lecturaDeCole(diego(), null).dias.length).toBeGreaterThan(0);
  });
});

describe("motor del cole", () => {
  function bd() {
    const d = { datos: vacia, llamadas: 0 };
    const nube: NubeTablas<LecturaCole, CambiosCole> = {
      async leer() {
        return structuredClone(d.datos);
      },
      async aplicar(c) {
        d.llamadas++;
        d.datos = aplicarCambiosALecturaCole(d.datos, structuredClone(c));
      },
    };
    return { d, nube };
  }
  const abrir = (nube: NubeTablas<LecturaCole, CambiosCole>, estado: EstadoHogar) => {
    const m = { estado };
    const motor = new SincronizadorTablas(
      nube,
      {
        hogarId: "h",
        leer: () => m.estado,
        escribir: (e) => (m.estado = e),
        avisar: () => undefined,
      },
      adaptadorCole,
    );
    return { m, motor };
  };

  it("con las tablas del cole vacías no se activa; con datos, adopta y sincroniza cambios", async () => {
    const { d, nube } = bd();
    const e = diego();
    const a = abrir(nube, e);
    expect(await a.motor.iniciar()).toBe("sin-migrar");
    d.datos = aplicarCambiosALecturaCole(d.datos, cambiosCompletosCole(e));
    const b = abrir(nube, { ...e, colegio: {} });
    expect(await b.motor.iniciar()).toBe("activo");
    expect(Object.keys(b.m.estado.colegio)).toHaveLength(Object.keys(e.colegio).length);
    const f = Object.keys(e.colegio)[0] as keyof typeof e.colegio;
    b.m.estado = {
      ...b.m.estado,
      colegio: { ...b.m.estado.colegio, [f]: { ...b.m.estado.colegio[f]!, postre: "Helado" } },
    };
    await b.motor.sincronizar();
    expect(d.datos.dias.find((x) => x.fecha === f)?.postre).toBe("Helado");
    const c = abrir(nube, { ...e, colegio: {} });
    await c.motor.iniciar();
    expect(c.m.estado.colegio[f]?.postre).toBe("Helado"); // lo ve otro móvil
  });
});
