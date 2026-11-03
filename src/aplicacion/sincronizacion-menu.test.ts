import { describe, expect, it } from "vitest";
import { esUuid } from "@/dominio/identificadores";
import { estadoInicialDemo } from "./datos-demo";
import { type Accion, type EstadoHogar, reducir } from "./estado";
import { adaptadorMenu } from "./adaptadores-tablas";
import { SincronizadorTablas, type NubeTablas } from "./sincronizacion-tablas";
import type { EstadoSync } from "./sincronizacion";
import { aUuid, migrarIdsDePersonas } from "./tablas";
import {
  type CambiosMenu,
  type LecturaMenu,
  aplicarCambiosALecturaMenu,
  cambiosCompletosMenu,
  lecturaDeMenu,
  migrarIdsDeMenu,
} from "./tablas-menu";

const HOGAR = "5f3d4e1a-6b7c-4d8e-9f0a-1b2c3d4e5f60";
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** El catálogo compartido: el mismo nombre da siempre el mismo id (como `resolver_ingredientes`). */
const resolver = async (
  items: Array<{ clave: string; nombre: string }>,
): Promise<Record<string, string>> =>
  Object.fromEntries(items.map((i) => [i.clave, aUuid("catalogo", norm(i.nombre))]));

/** Un estado de un hogar que ya adoptó el menú: ids UUID y menú en la «base de datos». */
function bdConMenu() {
  const origen = estadoInicialDemo();
  const mapa = Object.fromEntries(
    origen.ingredientes.map((i) => [i.id, aUuid("catalogo", norm(i.nombre))]),
  );
  const migrado = migrarIdsDePersonas(migrarIdsDeMenu(origen, HOGAR, mapa), HOGAR);
  const vacia = lecturaDeMenu(
    {
      ...migrado,
      platos: [],
      excluirIngredientes: [],
      comidas: [],
      notasMenu: {},
      almuerzos: [],
      valoraciones: {},
    },
    HOGAR,
  );
  const bd = { datos: vacia, fallar: false, llamadas: 0 };
  const nube: NubeTablas<LecturaMenu, CambiosMenu> = {
    async leer() {
      return structuredClone(bd.datos);
    },
    async aplicar(c) {
      bd.llamadas++;
      if (bd.fallar) throw new Error("Failed to fetch");
      bd.datos = aplicarCambiosALecturaMenu(bd.datos, structuredClone(c));
    },
  };
  return { origen, migrado, bd, nube };
}

function dispositivo(nube: NubeTablas<LecturaMenu, CambiosMenu>, inicial: EstadoHogar) {
  const d = {
    estado: inicial,
    avisos: [] as EstadoSync[],
    copias: 0,
    despachar: (a: Accion) => void (d.estado = reducir(d.estado, a)),
  };
  const { adaptador, resolucion } = adaptadorMenu(HOGAR, resolver);
  const motor = new SincronizadorTablas(
    nube,
    {
      hogarId: HOGAR,
      leer: () => d.estado,
      escribir: (e) => (d.estado = e),
      avisar: (s) => d.avisos.push(s),
      antesDeAdoptar: () => d.copias++,
    },
    adaptador,
  );
  return { d, motor, resolucion };
}

describe("motor del menú", () => {
  it("con las tablas del menú vacías no se activa", async () => {
    const { origen, nube } = bdConMenu();
    const { d, motor } = dispositivo(nube, origen);
    expect(await motor.iniciar()).toBe("sin-migrar");
    expect(d.estado).toBe(origen);
  });

  it("tras importar adopta el menú: ids UUID por todas partes y copia previa", async () => {
    const { origen, migrado, bd, nube } = bdConMenu();
    bd.datos = aplicarCambiosALecturaMenu(bd.datos, cambiosCompletosMenu(migrado, HOGAR));
    const { d, motor } = dispositivo(nube, origen);
    expect(await motor.iniciar()).toBe("activo");
    expect(d.estado.platos.every((p) => esUuid(p.id))).toBe(true);
    expect(d.estado.ingredientes.every((i) => esUuid(i.id))).toBe(true);
    expect(d.estado.despensa.every((x) => esUuid(x.ingredienteId))).toBe(true);
    expect(d.estado.platos.length).toBe(origen.platos.length);
    expect(d.copias).toBe(1);
  });

  it("elegir una cena con dos platos y una nota llega a las tablas y a otro dispositivo", async () => {
    const { origen, migrado, bd, nube } = bdConMenu();
    bd.datos = aplicarCambiosALecturaMenu(bd.datos, cambiosCompletosMenu(migrado, HOGAR));
    const a = dispositivo(nube, origen);
    const b = dispositivo(nube, origen);
    await a.motor.iniciar();
    await b.motor.iniciar();
    const [p1, p2] = a.d.estado.platos;
    a.d.despachar({ tipo: "menu/elegir", fecha: "2026-11-12", platoId: p1!.id });
    a.d.despachar({ tipo: "menu/anadir", fecha: "2026-11-12", platoId: p2!.id });
    a.d.despachar({ tipo: "menu/nota", fecha: "2026-11-12", texto: "o igual lomo" });
    await a.motor.sincronizar();
    const slot = bd.datos.comidas.find((c) => c.fecha === "2026-11-12");
    expect(slot?.platos).toEqual([p1!.id, p2!.id]);
    expect(bd.datos.notas.find((n) => n.fecha === "2026-11-12")?.texto).toBe("o igual lomo");
    await b.motor.recibir();
    expect(
      b.d.estado.comidas.filter((c) => c.fecha === "2026-11-12").map((c) => c.plato.id),
    ).toEqual([p1!.id, p2!.id]);
    expect(b.d.estado.notasMenu["2026-11-12"]).toBe("o igual lomo");
  });

  it("un ingrediente creado después de adoptar se resuelve contra el catálogo antes de enviar", async () => {
    const { origen, migrado, bd, nube } = bdConMenu();
    bd.datos = aplicarCambiosALecturaMenu(bd.datos, cambiosCompletosMenu(migrado, HOGAR));
    const a = dispositivo(nube, origen);
    await a.motor.iniciar();
    a.d.despachar({
      tipo: "ingrediente/crear",
      ingrediente: { nombre: "Calamar", unidad: "g", seccion: "pescado" },
    });
    const nuevo = a.d.estado.ingredientes.find((i) => i.nombre === "Calamar")!;
    expect(esUuid(nuevo.id)).toBe(false);
    a.d.despachar({
      tipo: "plato/guardar",
      plato: {
        nombre: "Calamares",
        grupo: "pescado",
        minutosActivos: 15,
        pasos: null,
        ingredientes: [{ ingredienteId: nuevo.id, cantidadPorRacion: 150, opcional: false }],
      },
    });
    await a.motor.sincronizar();
    const enTablas = bd.datos.platos.find((p) => p.nombre === "Calamares")!;
    expect(esUuid(enTablas.ingredientes[0]!.ingredienteId)).toBe(true);
    expect(a.d.estado.ingredientes.every((i) => esUuid(i.id))).toBe(true);
    expect(
      a.d.estado.platos.find((p) => p.nombre === "Calamares")!.ingredientes[0]!.ingredienteId,
    ).toBe(enTablas.ingredientes[0]!.ingredienteId);
    expect(a.d.avisos.at(-1)).toBe("al-dia");
  });

  it("sin conexión no se pierde nada y se reenvía al volver", async () => {
    const { origen, migrado, bd, nube } = bdConMenu();
    bd.datos = aplicarCambiosALecturaMenu(bd.datos, cambiosCompletosMenu(migrado, HOGAR));
    const a = dispositivo(nube, origen);
    await a.motor.iniciar();
    bd.fallar = true;
    a.d.despachar({
      tipo: "plato/rapido",
      nombre: "Fideuà",
      grupo: "pasta",
      idBase: "0b1b0c1e-8f4e-4a4e-9c0e-2f0f7b6f0a11",
    });
    await a.motor.sincronizar();
    expect(a.d.avisos.at(-1)).toBe("sin-conexion");
    bd.fallar = false;
    await a.motor.sincronizar();
    expect(bd.datos.platos.some((p) => p.nombre === "Fideuà" && p.noProponer)).toBe(true);
  });
});
