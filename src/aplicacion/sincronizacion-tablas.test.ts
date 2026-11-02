import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "./datos-demo";
import { type Accion, type EstadoHogar, reducir } from "./estado";
import { SincronizadorTablas, type NubeTablas } from "./sincronizacion-tablas";
import type { EstadoSync } from "./sincronizacion";
import {
  type LecturaTablas,
  aplicarCambiosALectura,
  cambiosParaImportar,
  lecturaDeEstado,
} from "./tablas";

const HOGAR = "5f3d4e1a-6b7c-4d8e-9f0a-1b2c3d4e5f60";
const hoy = estadoInicialDemo().hoy;

/** Una «base de datos» en memoria que se comporta como las dos funciones SQL. */
function crearBd(inicial?: LecturaTablas) {
  const vacia = lecturaDeEstado(
    {
      ...estadoInicialDemo(),
      personas: [],
      cumples: [],
      agenda: [],
      eventos: {},
      casa: [],
      tareas: [],
      llegoTarde: [],
      saltados: [],
    },
    HOGAR,
  );
  const bd = { datos: inicial ?? vacia, fallar: false, llamadas: 0 };
  const nube: NubeTablas = {
    async leer() {
      return structuredClone(bd.datos);
    },
    async aplicar(c) {
      bd.llamadas++;
      if (bd.fallar) throw new Error("Failed to fetch");
      bd.datos = aplicarCambiosALectura(bd.datos, structuredClone(c));
    },
  };
  return { bd, nube };
}

function dispositivo(nube: NubeTablas, inicial: EstadoHogar) {
  const d = {
    estado: inicial,
    avisos: [] as EstadoSync[],
    copias: 0,
    despachar(a: Accion) {
      d.estado = reducir(d.estado, a);
    },
  };
  const motor = new SincronizadorTablas(nube, {
    hogarId: HOGAR,
    leer: () => d.estado,
    escribir: (e) => (d.estado = e),
    avisar: (s) => d.avisos.push(s),
    antesDeAdoptar: () => d.copias++,
  });
  return { d, motor };
}

const demoConDatos = (): EstadoHogar =>
  reducir(estadoInicialDemo(), {
    tipo: "casa/plantilla",
    conjunto: "gatos",
    idBase: "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11",
  });

describe("motor por tablas", () => {
  it("con las tablas vacías no se activa: sigue mandando el documento", async () => {
    const { nube } = crearBd();
    const { d, motor } = dispositivo(nube, demoConDatos());
    expect(await motor.iniciar()).toBe("sin-migrar");
    expect(motor.activo).toBe(false);
    const antes = d.estado;
    await motor.sincronizar();
    expect(d.estado).toBe(antes);
  });

  it("tras importar, adopta las tablas, pasa las personas a UUID y guarda una copia", async () => {
    const origen = demoConDatos();
    const { bd, nube } = crearBd();
    bd.datos = aplicarCambiosALectura(bd.datos, cambiosParaImportar(origen, HOGAR, null));
    const { d, motor } = dispositivo(nube, origen);
    expect(await motor.iniciar()).toBe("activo");
    expect(d.estado.personas.every((p) => /^[0-9a-f-]{36}$/.test(p.id))).toBe(true);
    expect(d.estado.casa.length).toBe(origen.casa.length);
    expect(d.copias).toBe(1);
    // Las cargas del reparto, que nombran a personas, siguen apuntando a alguien que existe.
    const ids = new Set(d.estado.personas.map((p) => p.id));
    for (const c of d.estado.cargas)
      if (c.responsableId) expect(ids.has(c.responsableId)).toBe(true);
  });

  it("un cambio propio llega a las tablas (solo lo cambiado) y otro dispositivo lo recibe", async () => {
    const origen = demoConDatos();
    const { bd, nube } = crearBd();
    bd.datos = aplicarCambiosALectura(bd.datos, cambiosParaImportar(origen, HOGAR, null));
    const a = dispositivo(nube, origen);
    const b = dispositivo(nube, origen);
    await a.motor.iniciar();
    await b.motor.iniciar();
    a.d.despachar({
      tipo: "casa/anadir",
      titulo: "Regar plantas",
      cadaDias: 3,
      responsableId: null,
      idBase: "1c2c1d2f-9a5f-4b5f-8d1f-3a1a8c7a1b22",
    });
    await a.motor.sincronizar();
    expect(bd.datos.casa.some((t) => t.titulo === "Regar plantas")).toBe(true);
    const llamadas = bd.llamadas;
    await a.motor.sincronizar(); // nada nuevo: no llama
    expect(bd.llamadas).toBe(llamadas);
    await b.motor.recibir();
    expect(b.d.estado.casa.some((t) => t.titulo === "Regar plantas")).toBe(true);
  });

  it("cambios a la vez de dos dispositivos en cosas distintas se conservan los dos", async () => {
    const origen = demoConDatos();
    const { bd, nube } = crearBd();
    bd.datos = aplicarCambiosALectura(bd.datos, cambiosParaImportar(origen, HOGAR, null));
    const a = dispositivo(nube, origen);
    const b = dispositivo(nube, origen);
    await a.motor.iniciar();
    await b.motor.iniciar();
    a.d.despachar({
      tipo: "casa/anadir",
      titulo: "Cosa de A",
      cadaDias: 3,
      responsableId: null,
      idBase: "1c2c1d2f-9a5f-4b5f-8d1f-3a1a8c7a1b22",
    });
    b.d.despachar({
      tipo: "cumple/anadir",
      nombre: "Cumple de B",
      dia: 3,
      mes: 4,
      relacion: "amigo",
      idBase: "2d3d2e3f-0b6f-4c6f-9e2f-4b2b9d8b2c33",
    });
    await a.motor.sincronizar();
    // B recibe lo de A sin perder lo suyo aún sin enviar, y luego lo envía.
    await b.motor.recibir();
    expect(b.d.estado.casa.some((t) => t.titulo === "Cosa de A")).toBe(true);
    expect(b.d.estado.cumples.some((c) => c.nombre === "Cumple de B")).toBe(true);
    await b.motor.sincronizar();
    expect(bd.datos.cumples.some((c) => c.nombre === "Cumple de B")).toBe(true);
    expect(bd.datos.casa.some((t) => t.titulo === "Cosa de A")).toBe(true);
    await a.motor.recibir();
    expect(a.d.estado.cumples.some((c) => c.nombre === "Cumple de B")).toBe(true);
  });

  it("sin conexión no se pierde nada: se avisa y se reenvía al volver", async () => {
    const origen = demoConDatos();
    const { bd, nube } = crearBd();
    bd.datos = aplicarCambiosALectura(bd.datos, cambiosParaImportar(origen, HOGAR, null));
    const a = dispositivo(nube, origen);
    await a.motor.iniciar();
    bd.fallar = true;
    a.d.despachar({
      tipo: "casa/anadir",
      titulo: "Sin red",
      cadaDias: 3,
      responsableId: null,
      idBase: "1c2c1d2f-9a5f-4b5f-8d1f-3a1a8c7a1b22",
    });
    await a.motor.sincronizar();
    expect(a.d.avisos.at(-1)).toBe("sin-conexion");
    expect(bd.datos.casa.some((t) => t.titulo === "Sin red")).toBe(false);
    bd.fallar = false;
    await a.motor.sincronizar();
    expect(bd.datos.casa.some((t) => t.titulo === "Sin red")).toBe(true);
    expect(a.d.avisos.at(-1)).toBe("al-dia");
  });

  it("borrar y marcar hecha llegan como bajas y cambios de fila", async () => {
    const origen = demoConDatos();
    const { bd, nube } = crearBd();
    bd.datos = aplicarCambiosALectura(bd.datos, cambiosParaImportar(origen, HOGAR, null));
    const a = dispositivo(nube, origen);
    await a.motor.iniciar();
    const [primera, segunda] = a.d.estado.casa;
    a.d.despachar({ tipo: "casa/hecha", id: primera!.id });
    a.d.despachar({ tipo: "casa/borrar", id: segunda!.id });
    await a.motor.sincronizar();
    expect(bd.datos.casa.find((t) => t.id === primera!.id)?.ultimaVez).toBe(hoy);
    expect(bd.datos.casa.some((t) => t.id === segunda!.id)).toBe(false);
  });

  it("el regalo propio no se reenvía: sin cambios en el regalo, no se manda `regalo`", async () => {
    let origen = demoConDatos();
    origen = reducir(origen, {
      tipo: "cumple/anadir",
      nombre: "Ana",
      dia: 7,
      mes: 11,
      relacion: "familia",
      idBase: "2d3d2e3f-0b6f-4c6f-9e2f-4b2b9d8b2c33",
    });
    const { bd, nube } = crearBd();
    bd.datos = aplicarCambiosALectura(bd.datos, cambiosParaImportar(origen, HOGAR, null));
    // Para Ana el regalo llega nulo.
    bd.datos = {
      ...bd.datos,
      cumples: bd.datos.cumples.map((c) => ({ ...c, regalo: null, ideas: [] })),
    };
    const enviados: unknown[] = [];
    const original = nube.aplicar;
    nube.aplicar = async (c) => {
      enviados.push(c);
      return original(c);
    };
    const a = dispositivo(nube, origen);
    await a.motor.iniciar();
    const cumple = a.d.estado.cumples[0]!;
    a.d.estado = {
      ...a.d.estado,
      cumples: a.d.estado.cumples.map((c) => (c.id === cumple.id ? { ...c, nombre: "Ana B" } : c)),
    };
    await a.motor.sincronizar();
    const fila = (enviados.at(-1) as { cumples: { upsert: Array<Record<string, unknown>> } })
      .cumples.upsert[0]!;
    expect(fila.nombre).toBe("Ana B");
    expect(fila).not.toHaveProperty("regalo");
    expect(fila).not.toHaveProperty("ideas");
  });
});
