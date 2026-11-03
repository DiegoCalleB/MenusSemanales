import { describe, expect, it, vi } from "vitest";
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

describe("antes de adoptar el estado de la nube", () => {
  it("avisa con el estado del dispositivo y el de la nube, una vez, solo al adoptar", async () => {
    const nube = new NubeFalsa();
    const primero = dispositivo(nube);
    primero.hacer({ tipo: "manual/anadir", nombre: "Leche de la familia" });
    await primero.d.s.iniciar(); // la nube está vacía: sube, no adopta
    const llamadas: Array<[string | undefined, string | undefined]> = [];
    // Un segundo móvil con datos propios distintos.
    const d2 = {
      estado: reducir(estadoInicialDemo(), { tipo: "manual/anadir", nombre: "Cosa mía" }),
    };
    const s2 = new Sincronizador(nube, {
      leer: () => d2.estado,
      escribir: (e) => (d2.estado = e),
      avisar: () => undefined,
      antesDeAdoptar: (local, remoto) =>
        llamadas.push([local.manuales.at(-1)?.nombre, remoto.manuales.at(-1)?.nombre]),
    });
    expect(await s2.iniciar()).toBe("adoptado");
    expect(llamadas).toEqual([["Cosa mía", "Leche de la familia"]]);
    expect(d2.estado.manuales.at(-1)?.nombre).toBe("Leche de la familia");
    expect(nombres(d2.estado)).not.toContain("Cosa mía");
    // El primer móvil subió: no había nada que adoptar ni que avisar.
    const sin = vi.fn();
    const nubeVacia = new NubeFalsa();
    const s3 = new Sincronizador(nubeVacia, {
      leer: () => estadoInicialDemo(),
      escribir: () => undefined,
      avisar: () => undefined,
      antesDeAdoptar: sin,
    });
    expect(await s3.iniciar()).toBe("subido");
    expect(sin).not.toHaveBeenCalled();
  });
});

describe("sin conexión: lo pendiente sobrevive a cerrar la app y se envía al volver (D-102)", () => {
  /** El «almacenamiento del móvil»: lo que se guarda aquí sobrevive a «cerrar la app». */
  const movil = () => {
    const disco: { pendientes: Accion[] } = { pendientes: [] };
    return {
      disco,
      entorno: {
        cargarPendientes: () => structuredClone(disco.pendientes),
        guardarPendientes: (a: readonly Accion[]) =>
          void (disco.pendientes = structuredClone([...a])),
      },
    };
  };

  it("un cambio hecho sin conexión se guarda en el móvil y llega a la nube tras reabrir la app", async () => {
    const nube = new NubeFalsa();
    const { disco, entorno } = movil();
    const estado0 = estadoInicialDemo();
    // La nube ya tiene el estado de la familia.
    nube.guardado = { estado: structuredClone(paraNube(estado0)), version: 1 };

    // Sesión 1: abre con conexión, luego se queda sin internet y hace un cambio.
    let local = structuredClone(estado0);
    const s1 = new Sincronizador(nube, {
      leer: () => local,
      escribir: (e) => (local = e),
      avisar: () => undefined,
      ...entorno,
    });
    await s1.iniciar();
    nube.fallaRed = true;
    const accion: Accion = { tipo: "manual/anadir", nombre: "Pañales" };
    local = reducir(local, accion);
    s1.registrar(accion);
    await s1.sincronizar();
    expect(nombres(nube.guardado!.estado)).not.toContain("Pañales"); // aún no está en la nube
    expect(disco.pendientes).toHaveLength(1); // pero está guardado en el móvil

    // «Se cierra la app»: se pierde todo lo que estaba en memoria. Vuelve la conexión.
    nube.fallaRed = false;
    let local2 = structuredClone(local); // lo que el móvil tenía guardado
    const avisos: EstadoSync[] = [];
    const s2 = new Sincronizador(nube, {
      leer: () => local2,
      escribir: (e) => (local2 = e),
      avisar: (x) => avisos.push(x),
      ...entorno,
    });
    await s2.iniciar();
    expect(s2.hayPendientes).toBe(true);
    expect(nombres(local2)).toContain("Pañales"); // no se pierde al adoptar la nube
    await s2.sincronizar();
    expect(nombres(nube.guardado!.estado)).toContain("Pañales"); // llegó a la nube
    expect(disco.pendientes).toHaveLength(0); // y ya no queda nada pendiente
    expect(avisos.at(-1)).toBe("al-dia");
  });

  it("si otro móvil cambió mientras tanto, se conservan los dos cambios", async () => {
    const nube = new NubeFalsa();
    const { entorno } = movil();
    const estado0 = estadoInicialDemo();
    nube.guardado = { estado: structuredClone(paraNube(estado0)), version: 1 };
    let local = structuredClone(estado0);
    const s1 = new Sincronizador(nube, {
      leer: () => local,
      escribir: (e) => (local = e),
      avisar: () => undefined,
      ...entorno,
    });
    await s1.iniciar();
    nube.fallaRed = true;
    const mio: Accion = { tipo: "manual/anadir", nombre: "Mío sin conexión" };
    local = reducir(local, mio);
    s1.registrar(mio);
    await s1.sincronizar();
    // Otro móvil sube su cambio.
    nube.fallaRed = false;
    const otro = dispositivo(nube, structuredClone(estado0));
    await otro.d.s.iniciar();
    otro.hacer({ tipo: "manual/anadir", nombre: "Del otro móvil" });
    await otro.d.s.sincronizar();
    // Reabro la app: se mezclan.
    let local2 = structuredClone(local);
    const s2 = new Sincronizador(nube, {
      leer: () => local2,
      escribir: (e) => (local2 = e),
      avisar: () => undefined,
      ...entorno,
    });
    await s2.iniciar();
    await s2.sincronizar();
    expect(nombres(nube.guardado!.estado)).toEqual(
      expect.arrayContaining(["Mío sin conexión", "Del otro móvil"]),
    );
  });
});

describe("abrir la app sin conexión (D-102)", () => {
  it("lo que se cambia se apunta en el móvil y, al volver la conexión, llega a la nube", async () => {
    const nube = new NubeFalsa();
    const estado0 = estadoInicialDemo();
    nube.guardado = { estado: structuredClone(paraNube(estado0)), version: 1 };
    let disco: Accion[] = [{ tipo: "manual/anadir", nombre: "De antes de cerrar" }];
    const entorno = {
      cargarPendientes: () => structuredClone(disco),
      guardarPendientes: (a: readonly Accion[]) => void (disco = structuredClone([...a])),
    };

    // Se abre sin internet: no se llama a iniciar(); solo se prepara.
    let local = reducir(structuredClone(estado0), disco[0]!);
    const avisos: EstadoSync[] = [];
    const s = new Sincronizador(nube, {
      leer: () => local,
      escribir: (e) => (local = e),
      avisar: (x) => avisos.push(x),
      ...entorno,
    });
    s.prepararSinConexion();
    expect(avisos.at(-1)).toBe("sin-conexion");
    expect(s.hayPendientes).toBe(true); // recoge lo que ya estaba pendiente
    const nueva: Accion = { tipo: "manual/anadir", nombre: "Ya sin internet" };
    local = reducir(local, nueva);
    s.registrar(nueva);
    expect(disco).toHaveLength(2); // apuntado en el móvil

    // Vuelve internet: se reabre la conexión como una sesión nueva.
    const s2 = new Sincronizador(nube, {
      leer: () => local,
      escribir: (e) => (local = e),
      avisar: () => undefined,
      ...entorno,
    });
    await s2.iniciar();
    await s2.sincronizar();
    expect(nombres(nube.guardado!.estado)).toEqual(
      expect.arrayContaining(["De antes de cerrar", "Ya sin internet"]),
    );
    expect(disco).toHaveLength(0);
  });
});
