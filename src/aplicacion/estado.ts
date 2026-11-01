import { calcularCompra, type ArticuloCompra } from "@/dominio/compra";
import {
  StockCaducadoError,
  StockInsuficienteError,
  aplicarMovimientos,
  descartarCaducados,
  invertirMovimientos,
  planificarCocinado,
} from "@/dominio/despensa";
import { type FechaIso, semanaDe, sumarDias, diaSemanaIso } from "@/dominio/fechas";
import {
  proponerMenu,
  type DiaMenu,
  type MenuCole,
  type MenuPropuesto,
  type PlatoMenu,
} from "@/dominio/menu";
import {
  calcularReparto,
  proponerRotacion,
  type Ocurrencia,
  type Reparto,
} from "@/dominio/reparto";
import type {
  Carga,
  ComidaPlanificada,
  Ingrediente,
  ItemDespensa,
  Movimiento,
  MovimientoAplicado,
  Persona,
  Turno,
  Ubicacion,
} from "@/dominio/tipos";

/**
 * Estado del hogar y su reductor. Es PURO (sin red, sin reloj, sin azar): recibe una acción y
 * devuelve el estado nuevo, usando las funciones del dominio. La interfaz lo consume con
 * `useReducer`; cuando haya acceso con cuenta, un adaptador de Supabase persistirá las mismas
 * operaciones sin cambiar esta lógica.
 */

export interface ArticuloManual {
  id: string;
  nombre: string;
  comprado: boolean;
}

export interface CompraRealizada {
  id: string;
  ingredienteId: string;
  nombre: string;
  cantidad: number;
  unidad: Ingrediente["unidad"];
  operacionId: string;
}

export interface Operacion {
  id: string;
  tipo: "compra" | "cocinar" | "ajuste";
  descripcion: string;
  aplicados: MovimientoAplicado[];
  deshecha: boolean;
}

export interface Aviso {
  /** Cambia con cada aviso, para reiniciar el temporizador de la interfaz. */
  id: number;
  tipo: "ok" | "error";
  texto: string;
  /** Si existe, el aviso ofrece «Deshacer» sobre esta operación. */
  operacionId?: string;
}

export interface EstadoHogar {
  hoy: FechaIso;
  ingredientes: Ingrediente[];
  platos: PlatoMenu[];
  /** Ingredientes que la familia no quiere ver en el menú (alergias, sabores que no gustan). */
  excluirIngredientes: string[];
  /** Menú del cole de cada día (primer y segundo plato). */
  colegio: Record<FechaIso, MenuCole>;
  /** Días en que se llega tarde: el tiempo máximo baja a 15 minutos. */
  llegoTarde: FechaIso[];
  personas: Persona[];
  despensa: ItemDespensa[];
  comidas: ComidaPlanificada[];
  manuales: ArticuloManual[];
  compras: CompraRealizada[];
  operaciones: Operacion[];
  cargas: Carga[];
  turnos: Turno[];
  ocurrencias: Ocurrencia[];
  siguienteId: number;
  aviso: Aviso | null;
}

export type Accion =
  | { tipo: "comprar"; ingredienteId: string }
  | { tipo: "manual/anadir"; nombre: string }
  | { tipo: "manual/alternar"; id: string }
  | { tipo: "manual/borrar"; id: string }
  | { tipo: "cocinar"; platoId: string; raciones: number }
  | { tipo: "ajustar"; ingredienteId: string; ubicacion: Ubicacion; delta: number }
  | { tipo: "tirarCaducado"; ingredienteId: string; ubicacion: Ubicacion }
  | { tipo: "deshacer"; operacionId: string }
  | { tipo: "menu/elegir"; fecha: FechaIso; platoId: string }
  | { tipo: "menu/quitar"; fecha: FechaIso }
  | { tipo: "menu/llegoTarde"; fecha: FechaIso }
  | { tipo: "hogar/sustituir"; estado: EstadoHogar }
  | { tipo: "cerrarAviso" }
  | { tipo: "reparto/asignarResponsable"; cargaId: string; personaId: string | null }
  | { tipo: "reparto/proponerRotacion" }
  | { tipo: "reparto/estadoTurno"; cargaId: string; fecha: FechaIso; estado: Turno["estado"] };

// --------------------------------------------------------------------------------------------
// Consultas (derivan datos del estado; no lo modifican)
// --------------------------------------------------------------------------------------------

const catalogo = (e: EstadoHogar) => new Map(e.ingredientes.map((i) => [i.id, i]));

/** Dónde se guarda lo que se compra: lo fresco, a la nevera; los congelados, al congelador. */
export function ubicacionDeCompra(ingrediente: Ingrediente): Ubicacion {
  if (ingrediente.seccion === "congelados") return "congelador";
  if (["carne", "pescado", "lacteos", "huevos", "fruta_verdura"].includes(ingrediente.seccion))
    return "nevera";
  return "despensa";
}

/** Lo que falta por comprar según el menú y los mínimos (ya descontado lo que hay y lo comprado). */
export function articulosPendientes(e: EstadoHogar): ArticuloCompra[] {
  return calcularCompra({
    comidas: e.comidas,
    despensa: e.despensa,
    ingredientes: catalogo(e),
    hoy: e.hoy,
  });
}

export function repartoDeLaSemana(e: EstadoHogar): Reparto {
  return calcularReparto({
    personas: e.personas,
    cargas: e.cargas,
    turnos: e.turnos,
    semana: semanaDe(e.hoy),
  });
}

/** Cenas que se planifican: desde hoy hasta el domingo. Entre semana, 30 min; el fin de semana, 60. */
export function diasDelMenu(e: EstadoHogar): DiaMenu[] {
  const { hasta } = semanaDe(e.hoy);
  const dias: DiaMenu[] = [];
  for (let f = e.hoy; f <= hasta; f = sumarDias(f, 1)) {
    const laborable = diaSemanaIso(f) <= 5;
    dias.push({
      fecha: f,
      minutosMax: e.llegoTarde.includes(f) ? 15 : laborable ? 30 : 60,
      cole: e.colegio[f] ?? null,
    });
  }
  return dias;
}

/** Opciones de cada día. Las cenas ya elegidas se respetan; para ver alternativas de un día elegido, pásalo en `liberar`. */
export function menuDeLaSemana(e: EstadoHogar, liberar?: FechaIso): MenuPropuesto {
  const dias = diasDelMenu(e);
  const fechas = new Set(dias.map((d) => d.fecha));
  const elegidos: Record<FechaIso, string> = {};
  for (const c of e.comidas) {
    if (fechas.has(c.fecha) && c.fecha !== liberar) elegidos[c.fecha] = c.plato.id;
  }
  return proponerMenu({
    hoy: e.hoy,
    dias,
    catalogo: e.platos,
    despensa: e.despensa,
    excluirIngredientes: e.excluirIngredientes,
    elegidos,
  });
}

const NOMBRE_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const nombreDia = (fecha: FechaIso): string => NOMBRE_DIA[diaSemanaIso(fecha) - 1] ?? "";

// --------------------------------------------------------------------------------------------
// Reductor
// --------------------------------------------------------------------------------------------

const ok = (e: EstadoHogar, texto: string, operacionId?: string): Aviso => ({
  id: e.siguienteId,
  tipo: "ok",
  texto,
  ...(operacionId ? { operacionId } : {}),
});
const error = (e: EstadoHogar, texto: string): Aviso => ({
  id: e.siguienteId,
  tipo: "error",
  texto,
});

/** Aplica movimientos y registra la operación. Si no se puede, devuelve el estado con un aviso de error. */
function operar(
  e: EstadoHogar,
  tipo: Operacion["tipo"],
  descripcion: string,
  movimientos: readonly Movimiento[],
  mensajeOk: string,
  extra?: (operacionId: string) => Partial<EstadoHogar>,
): EstadoHogar {
  try {
    const { despensa, aplicados } = aplicarMovimientos(e.despensa, movimientos, e.hoy);
    const operacionId = `op-${e.siguienteId}`;
    const siguiente: EstadoHogar = {
      ...e,
      despensa,
      operaciones: [
        ...e.operaciones,
        { id: operacionId, tipo, descripcion, aplicados, deshecha: false },
      ],
      siguienteId: e.siguienteId + 1,
      ...extra?.(operacionId),
    };
    return { ...siguiente, aviso: ok({ ...siguiente }, mensajeOk, operacionId) };
  } catch (err) {
    const texto =
      err instanceof StockInsuficienteError
        ? "No hay stock suficiente para hacerlo."
        : err instanceof StockCaducadoError
          ? "Hay stock caducado en esa ubicación: tíralo antes de añadir más."
          : "No se ha podido completar la operación.";
    return { ...e, siguienteId: e.siguienteId + 1, aviso: error(e, texto) };
  }
}

export function reducir(e: EstadoHogar, accion: Accion): EstadoHogar {
  switch (accion.tipo) {
    case "comprar": {
      const articulo = articulosPendientes(e).find((a) => a.ingredienteId === accion.ingredienteId);
      const ingrediente = catalogo(e).get(accion.ingredienteId);
      if (!articulo || !ingrediente) return e;
      const ubicacion = ubicacionDeCompra(ingrediente);
      const movimientos: Movimiento[] = [
        // Si había stock caducado en esa fila, se tira antes de meter el nuevo (el dominio lo exige).
        ...descartarCaducados(
          e.despensa.filter((i) => i.ingredienteId === ingrediente.id && i.ubicacion === ubicacion),
          e.hoy,
        ),
        { ingredienteId: ingrediente.id, ubicacion, delta: articulo.cantidad },
      ];
      return operar(
        e,
        "compra",
        `Compra: ${ingrediente.nombre}`,
        movimientos,
        `Comprado: ${ingrediente.nombre}.`,
        (operacionId) => ({
          compras: [
            ...e.compras,
            {
              id: `c-${e.siguienteId}`,
              ingredienteId: ingrediente.id,
              nombre: ingrediente.nombre,
              cantidad: articulo.cantidad,
              unidad: ingrediente.unidad,
              operacionId,
            },
          ],
        }),
      );
    }

    case "manual/anadir": {
      const nombre = accion.nombre.trim();
      if (nombre === "" || nombre.length > 80)
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, "Escribe un nombre (hasta 80 caracteres)."),
        };
      return {
        ...e,
        manuales: [...e.manuales, { id: `m-${e.siguienteId}`, nombre, comprado: false }],
        siguienteId: e.siguienteId + 1,
        aviso: null,
      };
    }
    case "manual/alternar":
      return {
        ...e,
        manuales: e.manuales.map((m) => (m.id === accion.id ? { ...m, comprado: !m.comprado } : m)),
      };
    case "manual/borrar":
      return { ...e, manuales: e.manuales.filter((m) => m.id !== accion.id) };

    case "cocinar": {
      const plato = e.platos.find((p) => p.id === accion.platoId);
      if (!plato || !(accion.raciones > 0)) return e;
      const plan = planificarCocinado({
        plato,
        raciones: accion.raciones,
        despensa: e.despensa,
        hoy: e.hoy,
      });
      if (plan.movimientos.length === 0) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, "No hay nada en la despensa para cocinar este plato."),
        };
      }
      const nombres = new Map(e.ingredientes.map((i) => [i.id, i.nombre]));
      const falta = plan.faltantes.map((f) => nombres.get(f.ingredienteId) ?? f.ingredienteId);
      const texto =
        falta.length === 0
          ? `Cocinado: ${plato.nombre}. Descontado de la despensa.`
          : `Cocinado: ${plato.nombre}. Faltaba: ${falta.join(", ")}.`;
      return operar(e, "cocinar", `Cocinar: ${plato.nombre}`, plan.movimientos, texto);
    }

    case "ajustar": {
      const nombre = catalogo(e).get(accion.ingredienteId)?.nombre ?? "ingrediente";
      const movimientos: Movimiento[] = [
        ...(accion.delta > 0
          ? descartarCaducados(
              e.despensa.filter(
                (i) => i.ingredienteId === accion.ingredienteId && i.ubicacion === accion.ubicacion,
              ),
              e.hoy,
            )
          : []),
        { ingredienteId: accion.ingredienteId, ubicacion: accion.ubicacion, delta: accion.delta },
      ];
      return operar(e, "ajuste", `Ajuste: ${nombre}`, movimientos, `Ajustado: ${nombre}.`);
    }

    case "tirarCaducado": {
      const nombre = catalogo(e).get(accion.ingredienteId)?.nombre ?? "ingrediente";
      const movimientos = descartarCaducados(
        e.despensa.filter(
          (i) => i.ingredienteId === accion.ingredienteId && i.ubicacion === accion.ubicacion,
        ),
        e.hoy,
      );
      if (movimientos.length === 0) return e;
      return operar(
        e,
        "ajuste",
        `Tirar caducado: ${nombre}`,
        movimientos,
        `Tirado lo caducado: ${nombre}.`,
      );
    }

    case "deshacer": {
      const operacion = e.operaciones.find((o) => o.id === accion.operacionId);
      if (!operacion || operacion.deshecha) return e;
      try {
        const { despensa } = aplicarMovimientos(
          e.despensa,
          invertirMovimientos(operacion.aplicados),
          e.hoy,
        );
        return {
          ...e,
          despensa,
          operaciones: e.operaciones.map((o) =>
            o.id === operacion.id ? { ...o, deshecha: true } : o,
          ),
          compras: e.compras.filter((c) => c.operacionId !== operacion.id),
          siguienteId: e.siguienteId + 1,
          aviso: ok(e, "Deshecho."),
        };
      } catch {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, "No se puede deshacer: parte del stock ya se ha consumido."),
        };
      }
    }

    case "menu/elegir": {
      const plato = e.platos.find((p) => p.id === accion.platoId);
      if (!plato || !diasDelMenu(e).some((d) => d.fecha === accion.fecha)) return e;
      const raciones = e.personas
        .filter((p) => p.activa)
        .reduce((suma, p) => suma + p.factorRacion, 0);
      const comida: ComidaPlanificada = {
        etiqueta: `Cena del ${nombreDia(accion.fecha)}`,
        fecha: accion.fecha,
        plato,
        raciones,
      };
      return {
        ...e,
        comidas: [...e.comidas.filter((c) => c.fecha !== accion.fecha), comida].sort((a, b) =>
          a.fecha.localeCompare(b.fecha),
        ),
        siguienteId: e.siguienteId + 1,
        aviso: ok(
          e,
          `Elegido para el ${nombreDia(accion.fecha)}: ${plato.nombre}. La compra se ha actualizado.`,
        ),
      };
    }

    case "menu/quitar":
      return {
        ...e,
        comidas: e.comidas.filter((c) => c.fecha !== accion.fecha),
        siguienteId: e.siguienteId + 1,
        aviso: ok(
          e,
          `Cena del ${nombreDia(accion.fecha)} sin decidir. La compra se ha actualizado.`,
        ),
      };

    case "menu/llegoTarde":
      return {
        ...e,
        llegoTarde: e.llegoTarde.includes(accion.fecha)
          ? e.llegoTarde.filter((f) => f !== accion.fecha)
          : [...e.llegoTarde, accion.fecha],
      };

    case "hogar/sustituir":
      return accion.estado;

    case "cerrarAviso":
      return e.aviso === null ? e : { ...e, aviso: null };

    case "reparto/asignarResponsable":
      return {
        ...e,
        cargas: e.cargas.map((c) =>
          c.id === accion.cargaId ? { ...c, responsableId: accion.personaId } : c,
        ),
      };

    case "reparto/estadoTurno":
      return {
        ...e,
        turnos: e.turnos.map((t) =>
          t.cargaId === accion.cargaId && t.fecha === accion.fecha
            ? { ...t, estado: accion.estado }
            : t,
        ),
      };

    case "reparto/proponerRotacion": {
      // Lo ya hecho o saltado no se toca; se reparte solo lo pendiente.
      const cerrados = e.turnos.filter((t) => t.estado !== "pendiente");
      const hechas = new Set(cerrados.map((t) => `${t.cargaId}|${t.fecha}`));
      const propuesta = proponerRotacion({
        personas: e.personas,
        cargas: e.cargas,
        ocurrencias: e.ocurrencias.filter((o) => !hechas.has(`${o.cargaId}|${o.fecha}`)),
        turnosExistentes: cerrados,
      });
      return {
        ...e,
        turnos: [...cerrados, ...propuesta.turnos],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Rotación propuesta: ${propuesta.turnos.length} turnos repartidos.`),
      };
    }
  }
}
