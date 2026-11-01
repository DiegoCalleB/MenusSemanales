import { calcularCompra, type ArticuloCompra } from "@/dominio/compra";
import {
  StockCaducadoError,
  StockInsuficienteError,
  aplicarMovimientos,
  descartarCaducados,
  invertirMovimientos,
  planificarCocinado,
} from "@/dominio/despensa";
import {
  ingredienteNuevoSchema,
  normalizarNombre,
  validarPlato,
  type IngredienteNuevo,
  type PlatoEditable,
} from "@/dominio/catalogo";
import { contarSemana } from "@/dominio/equilibrio";
import { explicarOpcion, type ExplicacionOpcion } from "@/dominio/explicacion";
import { cenaDeEmergencia, type OpcionEmergencia } from "@/dominio/emergencia";
import { proximosACaducar } from "@/dominio/despensa";
import { redondear } from "@/dominio/numeros";
import { type FechaIso, semanaDe, sumarDias, diaSemanaIso } from "@/dominio/fechas";
import {
  proponerMenu,
  type DiaMenu,
  type GrupoPlato,
  type MenuCole,
  type Opcion,
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
  /** Cuánto se planifica: lo que queda de semana o los próximos 15 días (para adelantar la compra). */
  horizonte: "semana" | "quincena";
  /** Valoraciones de 1 a 5: plato → persona → puntos. La media alimenta al motor del menú. */
  valoraciones: Record<string, Record<string, number>>;
  /** Fechas señaladas (cumpleaños, fiestas): se ven en el calendario y no se autocompletan. */
  eventos: Record<FechaIso, { titulo: string; emoji: string }>;
  /** Días en que no se planifica cena en casa (salir, comer fuera, no hace falta). */
  saltados: FechaIso[];
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
  | { tipo: "plato/guardar"; id?: string; plato: PlatoEditable }
  | { tipo: "plato/proponer"; id: string; proponer: boolean }
  | { tipo: "plato/borrar"; id: string }
  | { tipo: "ingrediente/crear"; ingrediente: IngredienteNuevo }
  | { tipo: "emergencia/cocinar"; platoId: string }
  | { tipo: "hogar/hoy"; fecha: FechaIso }
  | { tipo: "menu/saltar"; fecha: FechaIso }
  | { tipo: "menu/autocompletar" }
  | { tipo: "valorar"; platoId: string; personaId: string; puntos: number }
  | { tipo: "menu/horizonte"; horizonte: EstadoHogar["horizonte"] }
  | { tipo: "cole/importar"; dias: Record<FechaIso, MenuCole> }
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

/** Cenas que se planifican: desde hoy hasta el domingo (o 15 días). Entre semana, 30 min; el fin de semana, 60. */
/** Condiciones de una cena concreta: tiempo disponible y lo que comieron las niñas en el cole. */
export function diaMenuDe(e: EstadoHogar, fecha: FechaIso): DiaMenu {
  const laborable = diaSemanaIso(fecha) <= 5;
  return {
    fecha,
    minutosMax: e.llegoTarde.includes(fecha) ? 15 : laborable ? 30 : 60,
    cole: e.colegio[fecha] ?? null,
  };
}

/** ¿Se puede planificar esa fecha? Desde hoy y hasta 60 días por delante. */
export const fechaPlanificable = (e: EstadoHogar, fecha: FechaIso): boolean =>
  fecha >= e.hoy && fecha <= sumarDias(e.hoy, 60);

/** Opciones para una fecha cualquiera (la elegida no cuenta: así se ven alternativas). */
export function opcionesParaFecha(e: EstadoHogar, fecha: FechaIso) {
  if (!fechaPlanificable(e, fecha)) return [];
  const elegidos: Record<FechaIso, string> = {};
  for (const c of e.comidas) if (c.fecha !== fecha) elegidos[c.fecha] = c.plato.id;
  return (
    proponerMenu({
      hoy: e.hoy,
      dias: [diaMenuDe(e, fecha)],
      catalogo: e.platos.filter((p) => !p.noProponer),
      despensa: e.despensa,
      excluirIngredientes: e.excluirIngredientes,
      colegio: e.colegio,
      elegidos,
    }).dias[0]?.opciones ?? []
  );
}

export function diasDelMenu(e: EstadoHogar): DiaMenu[] {
  // Sábado o domingo: la «semana» que interesa es la siguiente, no los dos días que quedan.
  const iso = diaSemanaIso(e.hoy);
  const desde = e.horizonte === "semana" && iso >= 6 ? sumarDias(e.hoy, 8 - iso) : e.hoy;
  const hasta = e.horizonte === "quincena" ? sumarDias(e.hoy, 14) : semanaDe(desde).hasta;
  const dias: DiaMenu[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    dias.push(diaMenuDe(e, f));
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
    catalogo: e.platos.filter((p) => !p.noProponer),
    despensa: e.despensa,
    excluirIngredientes: e.excluirIngredientes,
    colegio: e.colegio,
    elegidos,
  });
}

/** Por qué se recomienda esa opción para ese día: cole, equilibrio de la semana, tiempo, caducidad, gusto. */
export function explicacionDe(e: EstadoHogar, fecha: FechaIso, opcion: Opcion): ExplicacionOpcion {
  const cenas: Record<FechaIso, GrupoPlato> = {};
  for (const c of e.comidas) {
    const grupo = e.platos.find((p) => p.id === c.plato.id)?.grupo;
    if (c.fecha !== fecha && grupo) cenas[c.fecha] = grupo;
  }
  const nombres = new Map(e.ingredientes.map((i) => [i.id, i.nombre]));
  const usa = new Set(
    opcion.plato.ingredientes.filter((i) => !i.opcional).map((i) => i.ingredienteId),
  );
  const caducan = proximosACaducar(e.despensa, e.hoy, 3)
    .filter((i) => usa.has(i.ingredienteId) && i.caducaEn)
    .map((i) => ({
      nombre: nombres.get(i.ingredienteId) ?? i.ingredienteId,
      caducaEn: i.caducaEn as FechaIso,
    }));
  return explicarOpcion({
    plato: opcion.plato,
    motivos: opcion.motivos,
    dia: diaMenuDe(e, fecha),
    hoy: e.hoy,
    semana: contarSemana(fecha, e.colegio, cenas),
    caducan,
  });
}

/** Raciones de adulto equivalentes de quienes cenan en casa. */
export const racionesDelHogar = (e: EstadoHogar): number =>
  e.personas.filter((p) => p.activa).reduce((suma, p) => suma + p.factorRacion, 0);

/** Qué cenar hoy con lo que hay en casa, rápido (D-033). */
export function cenaDeEmergenciaHoy(e: EstadoHogar): OpcionEmergencia[] {
  return cenaDeEmergencia({
    catalogo: e.platos.filter((p) => !p.noProponer),
    despensa: e.despensa,
    hoy: e.hoy,
    raciones: racionesDelHogar(e),
    excluirIngredientes: e.excluirIngredientes,
    cole: e.colegio[e.hoy] ?? null,
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
      if (!plato || !fechaPlanificable(e, accion.fecha)) return e;
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

    case "plato/guardar": {
      const r = validarPlato(accion.plato, new Set(e.ingredientes.map((i) => i.id)));
      if (!r.ok) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, r.errores[0] ?? "El plato no es válido."),
        };
      }
      const nombre = normalizarNombre(r.valor.nombre);
      if (e.platos.some((p) => p.id !== accion.id && normalizarNombre(p.nombre) === nombre)) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, "Ya tienes un plato con ese nombre."),
        };
      }
      const existente = accion.id ? e.platos.find((p) => p.id === accion.id) : undefined;
      if (accion.id && !existente) return e;
      const guardado: PlatoMenu = {
        ...r.valor,
        id: existente?.id ?? `p-${e.siguienteId}`,
        ultimaVez: existente?.ultimaVez ?? null,
        valoracion: existente?.valoracion ?? null,
        ...(existente?.noProponer ? { noProponer: true } : {}),
      };
      const platos = existente
        ? e.platos.map((p) => (p.id === existente.id ? guardado : p))
        : [...e.platos, guardado];
      return {
        ...e,
        platos,
        // Las cenas ya elegidas con este plato se actualizan para que la compra refleje los cambios.
        comidas: e.comidas.map((c) => (c.plato.id === guardado.id ? { ...c, plato: guardado } : c)),
        siguienteId: e.siguienteId + 1,
        aviso: ok(
          e,
          existente ? `Plato guardado: ${guardado.nombre}.` : `Plato añadido: ${guardado.nombre}.`,
        ),
      };
    }

    case "plato/proponer": {
      const plato = e.platos.find((p) => p.id === accion.id);
      if (!plato) return e;
      return {
        ...e,
        platos: e.platos.map((p) =>
          p.id === plato.id ? { ...p, noProponer: !accion.proponer } : p,
        ),
        siguienteId: e.siguienteId + 1,
        aviso: ok(
          e,
          accion.proponer
            ? `«${plato.nombre}» volverá a aparecer en las propuestas.`
            : `«${plato.nombre}» no se volverá a proponer.`,
        ),
      };
    }

    case "plato/borrar": {
      const plato = e.platos.find((p) => p.id === accion.id);
      if (!plato) return e;
      if (e.comidas.some((c) => c.plato.id === plato.id)) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(
            e,
            "Está elegido en el menú: quítalo de ahí primero (o deja de proponerlo).",
          ),
        };
      }
      const valoraciones = Object.fromEntries(
        Object.entries(e.valoraciones).filter(([id]) => id !== plato.id),
      );
      return {
        ...e,
        platos: e.platos.filter((p) => p.id !== plato.id),
        valoraciones,
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Plato borrado: ${plato.nombre}.`),
      };
    }

    case "ingrediente/crear": {
      const r = ingredienteNuevoSchema.safeParse(accion.ingrediente);
      if (!r.success) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, r.error.issues[0]?.message ?? "Ingrediente no válido."),
        };
      }
      if (
        e.ingredientes.some((i) => normalizarNombre(i.nombre) === normalizarNombre(r.data.nombre))
      ) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, "Ese ingrediente ya existe."),
        };
      }
      return {
        ...e,
        ingredientes: [...e.ingredientes, { id: `i-${e.siguienteId}`, ...r.data }],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Ingrediente añadido: ${r.data.nombre}.`),
      };
    }

    case "emergencia/cocinar": {
      // Elige el plato para hoy y lo cocina: se descuenta de la despensa y se puede deshacer.
      const elegido = reducir(e, { tipo: "menu/elegir", fecha: e.hoy, platoId: accion.platoId });
      if (elegido === e) return e;
      return reducir(elegido, {
        tipo: "cocinar",
        platoId: accion.platoId,
        raciones: racionesDelHogar(e),
      });
    }

    case "hogar/hoy":
      return e.hoy === accion.fecha ? e : { ...e, hoy: accion.fecha };

    case "menu/saltar":
      return {
        ...e,
        saltados: e.saltados.includes(accion.fecha)
          ? e.saltados.filter((f) => f !== accion.fecha)
          : [...e.saltados, accion.fecha],
        // Un día sin cena en casa no puede tener cena elegida.
        comidas: e.saltados.includes(accion.fecha)
          ? e.comidas
          : e.comidas.filter((c) => c.fecha !== accion.fecha),
      };

    case "menu/autocompletar": {
      // Rellena los días laborables sin cena (ni evento, ni saltados) con la mejor opción de cada
      // día, de uno en uno: cada elección condiciona las siguientes (no repetir, no mismo grupo).
      let actual = e;
      let rellenados = 0;
      for (const dia of diasDelMenu(e)) {
        const f = dia.fecha;
        if (diaSemanaIso(f) > 5 || e.saltados.includes(f) || e.eventos[f]) continue;
        if (actual.comidas.some((c) => c.fecha === f)) continue;
        const mejor = opcionesParaFecha(actual, f)[0];
        if (!mejor) continue;
        const siguiente = reducir(actual, {
          tipo: "menu/elegir",
          fecha: f,
          platoId: mejor.plato.id,
        });
        if (siguiente !== actual) rellenados++;
        actual = siguiente;
      }
      return {
        ...actual,
        siguienteId: actual.siguienteId + 1,
        aviso:
          rellenados > 0
            ? ok(
                actual,
                `He propuesto ${rellenados} ${rellenados === 1 ? "cena" : "cenas"}. Cambia las que quieras.`,
              )
            : error(actual, "No hay días sin cena que rellenar."),
      };
    }

    case "valorar": {
      const plato = e.platos.find((p) => p.id === accion.platoId);
      const persona = e.personas.find((p) => p.id === accion.personaId && p.activa);
      if (!plato || !persona || !Number.isInteger(accion.puntos)) return e;
      if (accion.puntos < 0 || accion.puntos > 5) return e;
      const delPlato = { ...(e.valoraciones[plato.id] ?? {}) };
      // Pulsar de nuevo la misma puntuación (o 0) la quita.
      if (accion.puntos === 0 || delPlato[persona.id] === accion.puntos)
        delete delPlato[persona.id];
      else delPlato[persona.id] = accion.puntos;
      const valores = Object.values(delPlato);
      const media =
        valores.length === 0
          ? null
          : redondear(valores.reduce((a, b) => a + b, 0) / valores.length, 2);
      return {
        ...e,
        valoraciones: { ...e.valoraciones, [plato.id]: delPlato },
        platos: e.platos.map((p) => (p.id === plato.id ? { ...p, valoracion: media } : p)),
      };
    }

    case "menu/horizonte":
      return { ...e, horizonte: accion.horizonte };

    case "cole/importar":
      return {
        ...e,
        colegio: { ...e.colegio, ...accion.dias },
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Menú del cole guardado: ${Object.keys(accion.dias).length} días.`),
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
