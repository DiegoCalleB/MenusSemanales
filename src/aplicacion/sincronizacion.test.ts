import { describe, expect, it } from "vitest";
import { estadoInicialDemo } from "./datos-demo";
import { type Accion, type EstadoHogar, reducir } from "./estado";
import {
  ConflictoVersion,
  type EstadoRemoto,
  type EstadoSync,
  type Nube,
  Sincronizador,
  esAccionSincronizable,
  paraNube,
} from "./sincronizacion";

/** Nube falsa en memoria, con versión y conflicto como la de verdad. */
class NubeFalsa implements Nube {
  guardado: EstadoRemoto | null = null;
  fallaRed = false;
  async leer() {
    if (this.fallaRed) throw new Error("Failed to fetch");
    return this.guardado ? structuredClone(this.guardado) : null;
  }
  async guardar(estado: EstadoHogar, versionEsperada: number) {
    if (this.fallaRed) throw new Error("Failed to fetch");
    const actual = this.guardado?.version ?? 0;
    if (actual !== versionEsperada) throw new ConflictoVersion();
    this.guardado = { estado: structuredClone(estado), version: actual + 1 };
    return actual + 1;
  }
}

/** Un dispositivo: su estado local, su sincronizador y un registro de estados. */
function dispositivo(nube: Nube, inicial: EstadoHogar = estadoInicialDemo()) {
  const d = { estado: inicial, avisos: [] as EstadoSync[], s: null as unknown as Sincronizador };
  d.s = new Sincronizador(nube, {
    leer: () => d.estado,
    escribir: (e) => (d.estado = e),
    avisar: (x) => d.avisos.push(x),
  });
  const hacer = (a: Accion) => {
    d.estado = reducir(d.estado, a);
    d.s.registrar(a);
  };
  return { d, hacer };
}
const nombres = (e: EstadoHogar) => e.manuales.map((m) => m.nombre);

describe("sincronización entre dispositivos", () => {
  it("el primer dispositivo sube su estado; el segundo adopta el de la familia", async () => {
    const nube = new NubeFalsa();
    const a = dispositivo(nube);
    expect(await a.d.s.iniciar()).toBe("subido");
    expect(nube.guardado?.version).toBe(1);

    const b = dispositivo(nube, { ...estadoInicialDemo(), manuales: [], hoy: "2026-11-09" });
    expect(await b.d.s.iniciar()).toBe("adoptado");
    expect(nombres(b.d.estado)).toEqual(nombres(a.d.estado));
    expect(b.d.estado.hoy).toBe("2026-11-09"); // cada dispositivo conserva su «hoy»
  });

  it("un cambio se sube y el otro dispositivo lo recibe", async () => {
    const nube = new NubeFalsa();
    const a = dispositivo(nube);
    await a.d.s.iniciar();
    const b = dispositivo(nube);
    await b.d.s.iniciar();

    a.hacer({ tipo: "manual/anadir", nombre: "Pañales" });
    await a.d.s.sincronizar();
    expect(a.d.s.hayPendientes).toBe(false);
    expect(nube.guardado?.version).toBe(2);

    b.d.s.recibir(structuredClone(nube.guardado as EstadoRemoto));
    expect(nombres(b.d.estado)).toContain("Pañales");
  });

  it("dos dispositivos cambian a la vez: no se pierde ninguno de los dos cambios", async () => {
    const nube = new NubeFalsa();
    const a = dispositivo(nube);
    await a.d.s.iniciar();
    const b = dispositivo(nube);
    await b.d.s.iniciar();

    a.hacer({ tipo: "manual/anadir", nombre: "Leche" });
    b.hacer({ tipo: "manual/anadir", nombre: "Pan" });
    b.hacer({ tipo: "tarea/anadir", personaId: "ana", texto: "Cocina", frecuencia: "puntual" });
    await a.d.s.sincronizar(); // A guarda primero
    await b.d.s.sincronizar(); // B choca, baja lo de A y reaplica lo suyo
    expect(nube.guardado?.version).toBe(3);
    const final = nube.guardado?.estado as EstadoHogar;
    expect(nombres(final)).toEqual(expect.arrayContaining(["Leche", "Pan"]));
    expect(final.tareas.map((t) => t.texto)).toContain("Cocina");
    expect(nombres(b.d.estado)).toEqual(nombres(final));
    // Los identificadores no chocan aunque ambos partieran del mismo contador.
    const ids = final.manuales.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    // A recibe lo de B y converge.
    a.d.s.recibir(structuredClone(nube.guardado as EstadoRemoto));
    expect(nombres(a.d.estado).sort()).toEqual(nombres(final).sort());
  });

  it("el eco del propio guardado no se vuelve a aplicar, y lo de otro con cambios pendientes se reaplica", async () => {
    const nube = new NubeFalsa();
    const a = dispositivo(nube);
    await a.d.s.iniciar();
    const antes = a.d.estado;
    a.d.s.recibir({ estado: antes, version: 1 });
    expect(a.d.estado).toBe(antes); // mismo objeto: no se tocó

    a.hacer({ tipo: "manual/anadir", nombre: "Cervezas" }); // pendiente, sin subir
    const otro = reducir(antes, { tipo: "manual/anadir", nombre: "Agua" });
    a.d.s.recibir({ estado: otro, version: 2 });
    expect(nombres(a.d.estado)).toEqual(expect.arrayContaining(["Agua", "Cervezas"]));
  });

  it("lo que no son cambios del hogar no se sincroniza", () => {
    expect(esAccionSincronizable({ tipo: "cerrarAviso" })).toBe(false);
    expect(esAccionSincronizable({ tipo: "hogar/hoy", fecha: "2026-11-02" })).toBe(false);
    expect(esAccionSincronizable({ tipo: "hogar/sustituir", estado: estadoInicialDemo() })).toBe(
      false,
    );
    expect(esAccionSincronizable({ tipo: "manual/anadir", nombre: "x" })).toBe(true);
    expect(
      paraNube({ ...estadoInicialDemo(), aviso: { id: 1, tipo: "ok", texto: "x" } }).aviso,
    ).toBeNull();
  });

  it("sin red avisa y conserva los cambios para subirlos después", async () => {
    const nube = new NubeFalsa();
    const a = dispositivo(nube);
    await a.d.s.iniciar();
    a.hacer({ tipo: "manual/anadir", nombre: "Hielos" });
    nube.fallaRed = true;
    await a.d.s.sincronizar();
    expect(a.d.avisos.at(-1)).toBe("sin-conexion");
    expect(a.d.s.hayPendientes).toBe(true);
    nube.fallaRed = false;
    await a.d.s.sincronizar();
    expect(a.d.avisos.at(-1)).toBe("al-dia");
    expect(nombres(nube.guardado?.estado as EstadoHogar)).toContain("Hielos");
  });

  it("si la nube falla por otra razón, avisa de error; si el conflicto no se resuelve, también", async () => {
    const nube = new NubeFalsa();
    const a = dispositivo(nube);
    await a.d.s.iniciar();
    a.hacer({ tipo: "manual/anadir", nombre: "Sal" });
    nube.guardar = async () => {
      throw new Error("permiso denegado");
    };
    await a.d.s.sincronizar();
    expect(a.d.avisos.at(-1)).toBe("error");

    const nube2 = new NubeFalsa();
    const b = dispositivo(nube2);
    await b.d.s.iniciar();
    b.hacer({ tipo: "manual/anadir", nombre: "Sal" });
    nube2.guardar = async () => {
      throw new ConflictoVersion(); // choca siempre
    };
    await b.d.s.sincronizar();
    expect(b.d.avisos.at(-1)).toBe("error");
  });

  it("el primer contacto sin red lanza el error y avisa", async () => {
    const nube = new NubeFalsa();
    nube.fallaRed = true;
    const a = dispositivo(nube);
    await expect(a.d.s.iniciar()).rejects.toThrow();
    expect(a.d.avisos.at(-1)).toBe("sin-conexion");
  });

  it("una segunda llamada mientras se guarda se atiende al terminar", async () => {
    const nube = new NubeFalsa();
    const a = dispositivo(nube);
    await a.d.s.iniciar();
    a.hacer({ tipo: "manual/anadir", nombre: "Uno" });
    const primera = a.d.s.sincronizar();
    a.hacer({ tipo: "manual/anadir", nombre: "Dos" });
    const segunda = a.d.s.sincronizar(); // llega con la primera en curso
    await Promise.all([primera, segunda]);
    expect(nombres(nube.guardado?.estado as EstadoHogar)).toEqual(
      expect.arrayContaining(["Uno", "Dos"]),
    );
    expect(a.d.s.hayPendientes).toBe(false);
  });
});

describe("estado de la nube guardado antes de existir la agenda", () => {
  it("se completa y las acciones de agenda no fallan al rebasar", async () => {
    const { rebasar, desdeNube } = await import("./sincronizacion");
    const viejo: Partial<EstadoHogar> = { ...estadoInicialDemo() };
    delete viejo.agenda;
    const remoto = viejo as EstadoHogar;
    expect(desdeNube(remoto, estadoInicialDemo()).agenda).toEqual([]);
    const e = rebasar(
      remoto,
      [{ tipo: "agenda/anadir", texto: "5 Noviembre Prueba", personaId: null }],
      estadoInicialDemo(),
    );
    expect(e.agenda).toHaveLength(1);
  });
});
