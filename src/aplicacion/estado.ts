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
import {
  CATEGORIAS,
  type Categoria,
  MAX_LARGO_ARTICULO,
  claveArticulo,
  clasificarArticulo,
  partirDictado,
  separarCantidad,
} from "@/dominio/habituales";
import {
  type Cumple,
  type EstadoRegalo,
  type Relacion,
  avisosDeCumples,
  parsearCumples,
  proximaFecha,
} from "@/dominio/cumples";
import { type FrecuenciaTarea, type Tarea, alternarTarea } from "@/dominio/tareas";
import { type Almuerzo, MAX_LARGO_ALMUERZO } from "@/dominio/almuerzos";
import { type Apunte, parsearAgenda } from "@/dominio/agenda";
import {
  type ConjuntoCasa,
  PLANTILLAS,
  type TareaCasa,
  aplazarUnDia,
  marcarHecha,
  repartirEntre,
} from "@/dominio/casa";
import { contarSemana } from "@/dominio/equilibrio";
import { idDerivado } from "@/dominio/identificadores";
import { faltanComponentes } from "@/dominio/componentes";
import { explicarOpcion, type ExplicacionOpcion } from "@/dominio/explicacion";
import { cenaDeEmergencia, type OpcionEmergencia } from "@/dominio/emergencia";
import { proximosACaducar } from "@/dominio/despensa";
import { redondear } from "@/dominio/numeros";
import { type FechaIso, semanaDe, sumarDias, diaSemanaIso } from "@/dominio/fechas";
import {
  ordenarCatalogo,
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

export const MAX_LARGO_NOMBRE_PERSONA = 60;
export const MAX_LARGO_CANTIDAD = 20;

const sinClave = <T>(o: Record<string, T>, clave: string): Record<string, T> => {
  const { [clave]: _quitada, ...resto } = o;
  void _quitada;
  return resto;
};
export const MAX_LARGO_NOTA_MENU = 140;

export interface ArticuloManual {
  id: string;
  nombre: string;
  comprado: boolean;
  /** Sección del súper deducida del nombre (leche → lácteos, pañales → higiene…). */
  categoria?: Categoria;
  /** Cuánto: «2», «12», «1 kg». Texto libre y corto. */
  cantidad?: string;
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
  /** Cumpleaños (familia, amigos, cole) con las ideas y el estado del regalo. */
  cumples: Cumple[];
  /** Apuntes con fecha escritos a mano, como en una nota (D-075). */
  agenda: Apunte[];
  /** Lo recurrente de la casa: sábanas, toallas, filtros… (D-078). */
  casa: TareaCasa[];
  /** La comida del mediodía de los días en que hay que pensarla (D-079). */
  almuerzos: Almuerzo[];
  /** Cantidades de la compra cambiadas a mano (ingrediente → cantidad; 0 = no hace falta). */
  ajustesCompra: Record<string, number>;
  /** Nota corta de la cena de un día: «o igual lomo, depende» (D-096). */
  notasMenu: Record<FechaIso, string>;
  /** Tareas de cada persona (rutinas diarias y cosas puntuales). */
  tareas: Tarea[];
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
  | {
      tipo: "manual/importar";
      articulos: ReadonlyArray<{ nombre: string; cantidad: string; categoria: Categoria }>;
    }
  | { tipo: "manual/editar"; id: string; nombre?: string; cantidad?: string }
  | { tipo: "compra/cantidad"; ingredienteId: string; cantidad: number }
  | { tipo: "compra/restablecer"; ingredienteId: string }
  | { tipo: "manual/borrar"; id: string }
  | { tipo: "cocinar"; platoId: string; raciones: number }
  | { tipo: "ajustar"; ingredienteId: string; ubicacion: Ubicacion; delta: number }
  | { tipo: "tirarCaducado"; ingredienteId: string; ubicacion: Ubicacion }
  | { tipo: "deshacer"; operacionId: string }
  | { tipo: "menu/elegir"; fecha: FechaIso; platoId: string }
  | {
      tipo: "cumple/anadir";
      nombre: string;
      dia: number;
      mes: number;
      anio?: number | null;
      relacion: Relacion;
      gustos?: string[];
      personaId?: string | null;
      idBase?: string;
    }
  | { tipo: "cumple/importar"; texto: string; relacion: Relacion; idBase?: string }
  | {
      tipo: "persona/guardar";
      /** Sin `id`, se crea una persona nueva. */
      id?: string;
      nombre: string;
      personaTipo: Persona["tipo"];
      factorRacion: number;
      idBase?: string;
    }
  | { tipo: "persona/activar"; id: string; activa: boolean }
  | { tipo: "agenda/anadir"; texto: string; personaId: string | null; idBase?: string }
  | { tipo: "agenda/borrar"; id: string }
  | { tipo: "almuerzo/anadir"; fecha: FechaIso; texto?: string; platoId?: string; idBase?: string }
  | { tipo: "almuerzo/borrar"; id: string }
  | {
      tipo: "casa/anadir";
      titulo: string;
      cadaDias: number;
      responsableId: string | null;
      idBase?: string;
    }
  | { tipo: "casa/plantilla"; conjunto?: ConjuntoCasa; idBase?: string }
  | { tipo: "casa/aListaCompra"; id: string }
  | { tipo: "casa/hecha"; id: string }
  | { tipo: "casa/aplazar"; id: string }
  | { tipo: "casa/asignar"; id: string; responsableId: string | null }
  | { tipo: "casa/repartir" }
  | { tipo: "casa/borrar"; id: string }
  | { tipo: "cumple/borrar"; id: string }
  | { tipo: "cumple/idea"; id: string; texto: string }
  | { tipo: "cumple/quitarIdea"; id: string; texto: string }
  | { tipo: "cumple/estado"; id: string; estado: EstadoRegalo }
  | {
      tipo: "tarea/anadir";
      personaId: string;
      texto: string;
      frecuencia: FrecuenciaTarea;
      idBase?: string;
    }
  | { tipo: "tarea/alternar"; id: string }
  | { tipo: "tarea/borrar"; id: string }
  | { tipo: "menu/anadir"; fecha: FechaIso; platoId: string }
  | { tipo: "menu/quitar"; fecha: FechaIso; platoId?: string }
  | { tipo: "menu/llegoTarde"; fecha: FechaIso }
  | { tipo: "menu/nota"; fecha: FechaIso; texto: string }
  | { tipo: "plato/guardar"; id?: string; plato: PlatoEditable }
  | { tipo: "plato/rapido"; nombre: string; grupo: GrupoPlato; idBase?: string }
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
  | { tipo: "aviso/error"; texto: string }
  | { tipo: "reparto/asignarResponsable"; cargaId: string; personaId: string | null }
  | { tipo: "reparto/proponerRotacion" }
  | { tipo: "reparto/estadoTurno"; cargaId: string; fecha: FechaIso; estado: Turno["estado"] };

/**
 * Acciones que crean filas guardadas en tablas. Quien despacha les pone un `idBase` (UUID) y el
 * reductor deriva de él el id de cada fila, de modo que el resultado no depende de ningún
 * contador y repetir la acción da los mismos ids (D-089). Sin `idBase` (tests, datos antiguos)
 * se usa el contador de siempre.
 */
export const ACCIONES_QUE_CREAN = [
  "cumple/anadir",
  "cumple/importar",
  "persona/guardar",
  "plato/rapido",
  "agenda/anadir",
  "almuerzo/anadir",
  "casa/anadir",
  "casa/plantilla",
  "tarea/anadir",
] as const;

/** Id del plato que crea `plato/rapido` con ese `idBase`: así se puede usar en la misma jugada. */
export const idDePlatoRapido = (idBase: string): string => idDerivado(idBase, "plato:0");

export function conIdBase<A extends Accion>(accion: A, nuevoId: () => string): A {
  if (!(ACCIONES_QUE_CREAN as readonly string[]).includes(accion.tipo)) return accion;
  if ("idBase" in accion && accion.idBase) return accion;
  return { ...accion, idBase: nuevoId() };
}

/** Id de una fila nueva: derivado del `idBase` de la acción o, sin él, el de contador de siempre. */
function idNuevo(
  idBase: string | undefined,
  prefijo: string,
  clave: string,
  antiguo: string,
): string {
  return idBase ? idDerivado(idBase, `${prefijo}:${clave}`) : antiguo;
}

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
function pendientesCalculados(e: EstadoHogar): ArticuloCompra[] {
  return calcularCompra({
    comidas: [...e.comidas, ...almuerzosComoComidas(e)],
    despensa: e.despensa,
    ingredientes: catalogo(e),
    hoy: e.hoy,
  });
}

/** Lo que falta por comprar, con las cantidades que se hayan cambiado a mano. */
export function articulosPendientes(e: EstadoHogar): ArticuloCompra[] {
  return pendientesCalculados(e).flatMap((a) => {
    const ajuste = e.ajustesCompra[a.ingredienteId];
    if (ajuste === undefined) return [a];
    if (ajuste <= 0) return [];
    return [{ ...a, cantidad: ajuste, calculada: a.cantidad }];
  });
}

/** Lo que se ha quitado de la lista a mano («no hace falta»), por si se quiere volver a poner. */
export function articulosQuitados(e: EstadoHogar): ArticuloCompra[] {
  return pendientesCalculados(e).filter((a) => e.ajustesCompra[a.ingredienteId] === 0);
}

/** Las comidas del mediodía con plato del catálogo, para que sus ingredientes entren en la compra. */
function almuerzosComoComidas(e: EstadoHogar): ComidaPlanificada[] {
  const raciones = e.personas.filter((p) => p.activa).reduce((x, p) => x + p.factorRacion, 0);
  return e.almuerzos.flatMap((a) => {
    const plato = a.platoId ? e.platos.find((p) => p.id === a.platoId) : undefined;
    return plato && a.fecha >= e.hoy
      ? [{ etiqueta: `Comida del ${nombreDia(a.fecha)}`, fecha: a.fecha, plato, raciones }]
      : [];
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

/** Platos elegidos para una cena (puede haber varios si son pequeños). */
export const comidasDe = (e: EstadoHogar, fecha: FechaIso): ComidaPlanificada[] =>
  e.comidas.filter((c) => c.fecha === fecha);

/**
 * TODO el catálogo ordenado para una fecha: primero lo que encaja con el cole y con los días
 * vecinos (lo ya comido y lo ya planificado), después lo que no, con el motivo. Con `anadir`, se
 * buscan complementos para lo ya elegido.
 */
export function catalogoOrdenado(e: EstadoHogar, fecha: FechaIso, anadir = false) {
  if (!fechaPlanificable(e, fecha)) return [];
  const ya = comidasDe(e, fecha);
  const dia = diaMenuDe(e, fecha);
  if (anadir) {
    const usados = ya.reduce((suma, c) => suma + ((c.plato as PlatoMenu).minutosActivos ?? 0), 0);
    dia.minutosMax = Math.max(5, dia.minutosMax - usados);
  }
  return ordenarCatalogo({
    hoy: e.hoy,
    dias: [dia],
    catalogo: e.platos.filter((p) => !p.noProponer),
    despensa: e.despensa,
    excluirIngredientes: e.excluirIngredientes,
    colegio: e.colegio,
    elegidos: elegidosPrincipales(e, fecha),
    ...(anadir ? { complemento: true, excluirPlatos: ya.map((c) => c.plato.id) } : {}),
  });
}

/** Cumpleaños a menos de un mes con su urgencia (pensar, comprar, esta semana, hoy). */
export const cumplesProximos = (e: EstadoHogar, dias = 30) =>
  avisosDeCumples(e.cumples, e.hoy, dias);

/** Máximo de platos en una misma cena. */
export const MAX_PLATOS_POR_CENA = 3;

/** El plato que manda en la cena (el primero que no es pequeño): el motor se fija en él. */
const principal = (cs: readonly ComidaPlanificada[]): ComidaPlanificada | undefined =>
  cs.find((c) => !(c.plato as { ligero?: boolean }).ligero) ?? cs[0];

/** Fecha → plato principal de esa cena, sin contar `excepto`. */
function elegidosPrincipales(e: EstadoHogar, excepto?: FechaIso): Record<FechaIso, string> {
  const salida: Record<FechaIso, string> = {};
  for (const f of new Set(e.comidas.map((c) => c.fecha))) {
    if (f === excepto) continue;
    const p = principal(comidasDe(e, f));
    if (p) salida[f] = p.plato.id;
  }
  return salida;
}

/**
 * Opciones para una fecha cualquiera. Por defecto la elegida no cuenta (se ven alternativas); con
 * `anadir` se buscan complementos para lo ya elegido: platos pequeños que caben en el tiempo que
 * queda y que no se repiten.
 */
export function opcionesParaFecha(e: EstadoHogar, fecha: FechaIso, anadir = false) {
  if (!fechaPlanificable(e, fecha)) return [];
  const elegidos = elegidosPrincipales(e, fecha);
  const ya = comidasDe(e, fecha);
  const dia = diaMenuDe(e, fecha);
  if (anadir) {
    const usados = ya.reduce((suma, c) => suma + ((c.plato as PlatoMenu).minutosActivos ?? 0), 0);
    dia.minutosMax = Math.max(5, dia.minutosMax - usados);
  }
  return (
    proponerMenu({
      hoy: e.hoy,
      dias: [dia],
      ...(anadir ? { complemento: true, excluirPlatos: ya.map((c) => c.plato.id) } : {}),
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
  for (const [f, id] of Object.entries(elegidosPrincipales(e, liberar))) {
    if (fechas.has(f)) elegidos[f] = id;
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
  const cenas: Record<FechaIso, GrupoPlato[]> = {};
  for (const c of e.comidas) {
    const grupo = e.platos.find((p) => p.id === c.plato.id)?.grupo;
    if (c.fecha !== fecha && grupo) (cenas[c.fecha] ??= []).push(grupo);
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
    faltan: faltanComponentes(
      opcion.plato.ingredientes
        .filter((i) => !i.opcional)
        .flatMap((i) => {
          const ing = e.ingredientes.find((x) => x.id === i.ingredienteId);
          return ing ? [ing] : [];
        }),
    ),
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

const NOMBRE_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
export const nombreMes = (fecha: FechaIso): string =>
  NOMBRE_MES[Number(fecha.slice(5, 7)) - 1] ?? "";

/** Primer día desde `fecha` (incluida) con menú del cole, hasta 10 días por delante. */
export function proximoDiaConCole(e: EstadoHogar, fecha: FechaIso): FechaIso | null {
  for (let i = 0; i <= 10; i++) {
    const f = sumarDias(fecha, i);
    if (e.colegio[f]) return f;
  }
  return null;
}

const NOMBRE_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const nombreDia = (fecha: FechaIso): string => NOMBRE_DIA[diaSemanaIso(fecha) - 1] ?? "";

// --------------------------------------------------------------------------------------------
// Reductor
// --------------------------------------------------------------------------------------------

/** Completa lo que un estado guardado por una versión anterior no trae (agenda, casa y almuerzos, D-075, D-078 y D-079). */
export const normalizar = (e: EstadoHogar): EstadoHogar =>
  Array.isArray(e.agenda) &&
  Array.isArray(e.casa) &&
  Array.isArray(e.almuerzos) &&
  typeof e.notasMenu === "object" &&
  e.notasMenu !== null &&
  typeof e.ajustesCompra === "object" &&
  e.ajustesCompra !== null
    ? e
    : {
        ...e,
        ajustesCompra:
          typeof e.ajustesCompra === "object" && e.ajustesCompra !== null ? e.ajustesCompra : {},
        notasMenu: typeof e.notasMenu === "object" && e.notasMenu !== null ? e.notasMenu : {},
        agenda: Array.isArray(e.agenda) ? e.agenda : [],
        casa: Array.isArray(e.casa) ? e.casa : [],
        almuerzos: Array.isArray(e.almuerzos) ? e.almuerzos : [],
      };

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
          ajustesCompra: sinClave(e.ajustesCompra, ingrediente.id),
        }),
      );
    }

    case "compra/cantidad": {
      const bruto = pendientesCalculados(e).find((a) => a.ingredienteId === accion.ingredienteId);
      if (!bruto || !Number.isFinite(accion.cantidad) || accion.cantidad < 0) return e;
      const cantidad = Math.min(redondear(accion.cantidad, 2), 100000);
      return {
        ...e,
        ajustesCompra:
          cantidad === bruto.cantidad
            ? sinClave(e.ajustesCompra, accion.ingredienteId)
            : { ...e.ajustesCompra, [accion.ingredienteId]: cantidad },
      };
    }

    case "compra/restablecer":
      return { ...e, ajustesCompra: sinClave(e.ajustesCompra, accion.ingredienteId) };

    case "manual/importar": {
      // Artículos propuestos (p. ej. por la IA) y ya revisados por la persona: se validan igual.
      const yaEstan = new Set(
        e.manuales.filter((m) => !m.comprado).map((m) => claveArticulo(m.nombre)),
      );
      const nuevos: Array<{ nombre: string; cantidad: string; categoria: Categoria }> = [];
      for (const a of accion.articulos) {
        const nombre = a.nombre.replace(/\s+/g, " ").trim();
        const k = claveArticulo(nombre);
        if (nombre === "" || nombre.length > MAX_LARGO_ARTICULO || yaEstan.has(k)) continue;
        yaEstan.add(k);
        nuevos.push({
          nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
          cantidad: a.cantidad.replace(/\s+/g, " ").trim().slice(0, MAX_LARGO_CANTIDAD),
          categoria: CATEGORIAS.includes(a.categoria) ? a.categoria : clasificarArticulo(nombre),
        });
        if (nuevos.length >= 40) break;
      }
      if (nuevos.length === 0) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: ok(e, "Ya estaba todo en la lista."),
        };
      }
      return {
        ...e,
        manuales: [
          ...e.manuales,
          ...nuevos.map((n, i) => ({
            id: `m-${e.siguienteId}-${i}`,
            nombre: n.nombre,
            comprado: false,
            categoria: n.categoria,
            ...(n.cantidad ? { cantidad: n.cantidad } : {}),
          })),
        ],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Añadidos ${nuevos.length}: ${nuevos.map((n) => n.nombre).join(", ")}.`),
      };
    }

    case "manual/editar": {
      const actual = e.manuales.find((m) => m.id === accion.id);
      if (!actual) return e;
      const nombre =
        accion.nombre === undefined ? actual.nombre : accion.nombre.replace(/\s+/g, " ").trim();
      if (nombre === "" || nombre.length > MAX_LARGO_ARTICULO) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, `Escribe un nombre (hasta ${MAX_LARGO_ARTICULO} caracteres).`),
        };
      }
      const cantidad =
        accion.cantidad === undefined
          ? actual.cantidad
          : accion.cantidad.replace(/\s+/g, " ").trim().slice(0, MAX_LARGO_CANTIDAD);
      const { cantidad: _c, ...sinCantidad } = actual;
      void _c;
      return {
        ...e,
        manuales: e.manuales.map((m) =>
          m.id === actual.id
            ? {
                ...sinCantidad,
                nombre,
                categoria: nombre === actual.nombre ? actual.categoria : clasificarArticulo(nombre),
                ...(cantidad ? { cantidad } : {}),
              }
            : m,
        ),
      };
    }

    case "manual/anadir": {
      // Acepta varios artículos a la vez («leche, huevos y pan»): así sirve también para dictar.
      const nombres = partirDictado(accion.nombre);
      if (nombres.length === 0 || nombres.some((n) => n.length > MAX_LARGO_ARTICULO)) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, `Escribe un nombre (hasta ${MAX_LARGO_ARTICULO} caracteres).`),
        };
      }
      const yaEstan = new Set(
        e.manuales.filter((m) => !m.comprado).map((m) => claveArticulo(m.nombre)),
      );
      const separados = nombres.map(separarCantidad);
      const nuevos = separados.filter((n) => !yaEstan.has(claveArticulo(n.nombre)));
      if (nuevos.length === 0) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: ok(
            e,
            nombres.length === 1
              ? `${nombres[0]} ya estaba en la lista.`
              : "Ya estaba todo en la lista.",
          ),
        };
      }
      return {
        ...e,
        manuales: [
          ...e.manuales,
          ...nuevos.map(({ nombre, cantidad }, i) => ({
            id: `m-${e.siguienteId}-${i}`,
            nombre,
            comprado: false,
            categoria: clasificarArticulo(nombre),
            ...(cantidad ? { cantidad } : {}),
          })),
        ],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Añadido: ${nuevos.map((n) => n.nombre).join(", ")}.`),
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

    case "cumple/anadir": {
      const nombre = accion.nombre.trim();
      const maxDia = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][accion.mes - 1];
      if (
        nombre === "" ||
        nombre.length > 60 ||
        !maxDia ||
        !Number.isInteger(accion.dia) ||
        accion.dia < 1 ||
        accion.dia > maxDia
      ) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, "Revisa el nombre y la fecha."),
        };
      }
      if (
        e.cumples.some(
          (c) =>
            claveArticulo(c.nombre) === claveArticulo(nombre) &&
            c.dia === accion.dia &&
            c.mes === accion.mes,
        )
      ) {
        return { ...e, siguienteId: e.siguienteId + 1, aviso: ok(e, `${nombre} ya estaba.`) };
      }
      const persona =
        accion.personaId ??
        e.personas.find((p) => claveArticulo(p.nombre) === claveArticulo(nombre))?.id ??
        null;
      return {
        ...e,
        cumples: [
          ...e.cumples,
          {
            id: idNuevo(accion.idBase, "cumple", "0", `c-${e.siguienteId}`),
            nombre,
            dia: accion.dia,
            mes: accion.mes,
            anio: accion.anio ?? null,
            relacion: accion.relacion,
            personaId: persona,
            gustos: (accion.gustos ?? [])
              .map((g) => g.trim())
              .filter(Boolean)
              .slice(0, 10),
            ideas: [],
            estado: "sin-pensar",
            anioEstado: null,
          },
        ],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Cumpleaños de ${nombre} guardado.`),
      };
    }

    case "persona/guardar": {
      const nombre = accion.nombre.replace(/\s+/g, " ").trim();
      const factor = Math.round(accion.factorRacion * 100) / 100;
      if (
        nombre === "" ||
        nombre.length > MAX_LARGO_NOMBRE_PERSONA ||
        !(factor > 0 && factor <= 2) ||
        (accion.personaTipo !== "adulto" && accion.personaTipo !== "nino")
      ) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(
            e,
            `Escribe un nombre (hasta ${MAX_LARGO_NOMBRE_PERSONA} letras) y una ración entre 0,1 y 2.`,
          ),
        };
      }
      const repetida = e.personas.some(
        (p) => p.id !== accion.id && claveArticulo(p.nombre) === claveArticulo(nombre),
      );
      if (repetida) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, `Ya hay alguien que se llama ${nombre}.`),
        };
      }
      if (accion.id) {
        if (!e.personas.some((p) => p.id === accion.id)) return e;
        return {
          ...e,
          personas: e.personas.map((p) =>
            p.id === accion.id
              ? { ...p, nombre, tipo: accion.personaTipo, factorRacion: factor }
              : p,
          ),
          aviso: ok(e, `${nombre} guardado.`),
        };
      }
      return {
        ...e,
        personas: [
          ...e.personas,
          {
            id: idNuevo(accion.idBase, "persona", "0", `p-${e.siguienteId}`),
            nombre,
            tipo: accion.personaTipo,
            factorRacion: factor,
            activa: true,
          },
        ],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `${nombre} añadido a la familia.`),
      };
    }

    case "persona/activar": {
      const persona = e.personas.find((p) => p.id === accion.id);
      if (!persona || persona.activa === accion.activa) return e;
      // Siempre debe quedar alguien que coma en casa.
      if (!accion.activa && e.personas.filter((p) => p.activa).length <= 1) {
        return { ...e, aviso: error(e, "Tiene que quedar al menos una persona en casa.") };
      }
      return {
        ...e,
        personas: e.personas.map((p) => (p.id === accion.id ? { ...p, activa: accion.activa } : p)),
        aviso: ok(
          e,
          accion.activa ? `${persona.nombre} vuelve a contar.` : `${persona.nombre} ya no cuenta.`,
        ),
      };
    }

    case "cumple/importar": {
      const { validos, erroneos } = parsearCumples(accion.texto);
      let actual = e;
      validos.forEach((v, i) => {
        actual = reducir(actual, {
          tipo: "cumple/anadir",
          relacion: accion.relacion,
          ...v,
          ...(accion.idBase ? { idBase: idDerivado(accion.idBase, `importar:${i}`) } : {}),
        });
      });
      const nuevos = actual.cumples.length - e.cumples.length;
      const texto =
        erroneos.length > 0
          ? `Guardados ${nuevos}. No he entendido: ${erroneos.join("; ")}.`
          : `Guardados ${nuevos} cumpleaños.`;
      return {
        ...actual,
        siguienteId: actual.siguienteId + 1,
        aviso: nuevos === 0 && erroneos.length > 0 ? error(actual, texto) : ok(actual, texto),
      };
    }

    case "agenda/anadir": {
      const { conFecha, sinFecha, erroneos } = parsearAgenda(accion.texto, e.hoy);
      const clave = (f: string, t: string) => `${f}|${claveArticulo(t)}`;
      const ya = new Set(e.agenda.map((a) => clave(a.fecha, a.titulo)));
      const nuevos = conFecha.filter((a) => {
        const k = clave(a.fecha, a.titulo);
        if (ya.has(k)) return false;
        ya.add(k);
        return true;
      });
      const persona = e.personas.find((p) => p.id === accion.personaId && p.activa);
      const yaTarea = new Set(
        e.tareas.filter((t) => t.personaId === persona?.id).map((t) => claveArticulo(t.texto)),
      );
      const tareasNuevas = persona ? sinFecha.filter((t) => !yaTarea.has(claveArticulo(t))) : [];
      const sinDueno = persona ? [] : sinFecha;
      const partes = [
        nuevos.length > 0 ? `${nuevos.length} ${nuevos.length === 1 ? "apunte" : "apuntes"}` : "",
        tareasNuevas.length > 0
          ? `${tareasNuevas.length} ${tareasNuevas.length === 1 ? "tarea" : "tareas"}`
          : "",
      ].filter(Boolean);
      const noEntendido = [...erroneos, ...sinDueno];
      const texto =
        (partes.length > 0
          ? `Apuntado: ${partes.join(" y ")}.`
          : "No había nada nuevo que apuntar.") +
        (noEntendido.length > 0 ? ` No he entendido: ${noEntendido.join("; ")}.` : "");
      return {
        ...e,
        agenda: [
          ...e.agenda,
          ...nuevos.map((a, i) => ({
            id: idNuevo(accion.idBase, "agenda", String(i), `a-${e.siguienteId}-${i}`),
            ...a,
          })),
        ],
        tareas: [
          ...e.tareas,
          ...tareasNuevas.map((t, i) => ({
            id: idNuevo(accion.idBase, "tarea", `a${i}`, `t-${e.siguienteId}-a${i}`),
            personaId: persona?.id ?? "",
            texto: t,
            frecuencia: "puntual" as const,
            hechas: [],
          })),
        ],
        siguienteId: e.siguienteId + 1,
        aviso: partes.length === 0 && noEntendido.length > 0 ? error(e, texto) : ok(e, texto),
      };
    }

    case "almuerzo/anadir": {
      const plato = accion.platoId ? e.platos.find((p) => p.id === accion.platoId) : undefined;
      const texto = (plato?.nombre ?? accion.texto ?? "").replace(/\s+/g, " ").trim();
      if (
        texto === "" ||
        texto.length > MAX_LARGO_ALMUERZO ||
        (accion.platoId && !plato) ||
        !fechaPlanificable(e, accion.fecha)
      ) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(
            e,
            `Escribe qué se come (hasta ${MAX_LARGO_ALMUERZO} caracteres), en un día desde hoy y hasta dentro de 60 días.`,
          ),
        };
      }
      const k = claveArticulo(texto);
      if (e.almuerzos.some((a) => a.fecha === accion.fecha && claveArticulo(a.texto) === k)) {
        return { ...e, siguienteId: e.siguienteId + 1, aviso: ok(e, "Ya estaba apuntado.") };
      }
      return {
        ...e,
        almuerzos: [
          ...e.almuerzos,
          {
            id: idNuevo(accion.idBase, "almuerzo", "0", `m-${e.siguienteId}`),
            fecha: accion.fecha,
            texto,
            platoId: plato?.id ?? null,
          },
        ],
        siguienteId: e.siguienteId + 1,
        aviso: ok(
          e,
          `Comida del ${nombreDia(accion.fecha)}: ${texto}.${plato ? " La compra se ha actualizado." : ""}`,
        ),
      };
    }

    case "almuerzo/borrar":
      return { ...e, almuerzos: e.almuerzos.filter((a) => a.id !== accion.id) };

    case "casa/anadir": {
      const titulo = accion.titulo.replace(/\s+/g, " ").trim();
      if (titulo === "" || titulo.length > MAX_LARGO_ARTICULO || !(accion.cadaDias >= 1)) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, `Escribe qué hay que hacer (hasta ${MAX_LARGO_ARTICULO} caracteres).`),
        };
      }
      if (e.casa.some((t) => claveArticulo(t.titulo) === claveArticulo(titulo))) {
        return { ...e, siguienteId: e.siguienteId + 1, aviso: ok(e, "Ya estaba en la lista.") };
      }
      const responsable = e.personas.some((p) => p.id === accion.responsableId && p.activa)
        ? accion.responsableId
        : null;
      return {
        ...e,
        casa: [
          ...e.casa,
          {
            id: idNuevo(accion.idBase, "casa", "0", `c-${e.siguienteId}`),
            titulo,
            emoji: "🏠",
            cadaDias: Math.round(accion.cadaDias),
            responsableId: responsable,
            ultimaVez: null,
            desde: e.hoy,
          },
        ],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Apuntado: ${titulo}.`),
      };
    }

    case "casa/plantilla": {
      const ya = new Set(e.casa.map((t) => claveArticulo(t.titulo)));
      const conjunto = accion.conjunto ?? "casa";
      const nuevas = PLANTILLAS[conjunto].filter((p) => !ya.has(claveArticulo(p.titulo)));
      return {
        ...e,
        casa: [
          ...e.casa,
          ...nuevas.map((p, i) => ({
            id: idNuevo(accion.idBase, "casa", String(i), `c-${e.siguienteId}-${i}`),
            titulo: p.titulo,
            emoji: p.emoji,
            cadaDias: p.cadaDias,
            responsableId: null,
            ultimaVez: null,
            desde: sumarDias(e.hoy, p.empiezaEn),
            compra: p.compra ?? null,
          })),
        ],
        siguienteId: e.siguienteId + 1,
        aviso: ok(
          e,
          nuevas.length > 0
            ? `Añadidas ${nuevas.length} tareas${conjunto === "gatos" ? " de los gatos" : " de la casa"}. Cámbialas o quita las que no os valgan.`
            : "Ya estaba toda la plantilla.",
        ),
      };
    }

    case "casa/aListaCompra": {
      const t = e.casa.find((x) => x.id === accion.id);
      if (!t?.compra) return e;
      return reducir(e, { tipo: "manual/anadir", nombre: t.compra });
    }

    case "casa/hecha":
      return { ...e, casa: e.casa.map((t) => (t.id === accion.id ? marcarHecha(t, e.hoy) : t)) };

    case "casa/aplazar":
      return { ...e, casa: e.casa.map((t) => (t.id === accion.id ? aplazarUnDia(t, e.hoy) : t)) };

    case "casa/asignar": {
      const valido = e.personas.some((p) => p.id === accion.responsableId && p.activa);
      return {
        ...e,
        casa: e.casa.map((t) =>
          t.id === accion.id ? { ...t, responsableId: valido ? accion.responsableId : null } : t,
        ),
      };
    }

    case "casa/repartir": {
      const adultos = e.personas.filter((p) => p.tipo === "adulto" && p.activa).map((p) => p.id);
      const repartidas = repartirEntre(e.casa, adultos);
      const cambiadas = repartidas.filter((t, i) => t.responsableId !== e.casa[i]?.responsableId);
      return {
        ...e,
        casa: repartidas,
        siguienteId: e.siguienteId + 1,
        aviso:
          cambiadas.length > 0
            ? ok(e, `Repartidas ${cambiadas.length} entre los dos. Cambia las que no os cuadren.`)
            : ok(e, "No había nada sin responsable que repartir."),
      };
    }

    case "casa/borrar":
      return { ...e, casa: e.casa.filter((t) => t.id !== accion.id) };

    case "agenda/borrar":
      return { ...e, agenda: e.agenda.filter((a) => a.id !== accion.id) };

    case "cumple/borrar":
      return { ...e, cumples: e.cumples.filter((c) => c.id !== accion.id) };

    case "cumple/idea": {
      const texto = accion.texto.trim().slice(0, 120);
      if (texto === "") return e;
      return {
        ...e,
        cumples: e.cumples.map((c) =>
          c.id === accion.id && !c.ideas.some((i) => claveArticulo(i) === claveArticulo(texto))
            ? {
                ...c,
                ideas: [...c.ideas, texto].slice(0, 30),
                estado: c.estado === "sin-pensar" ? "idea" : c.estado,
              }
            : c,
        ),
      };
    }

    case "cumple/quitarIdea":
      return {
        ...e,
        cumples: e.cumples.map((c) =>
          c.id === accion.id ? { ...c, ideas: c.ideas.filter((i) => i !== accion.texto) } : c,
        ),
      };

    case "cumple/estado":
      return {
        ...e,
        cumples: e.cumples.map((c) =>
          c.id === accion.id
            ? {
                ...c,
                estado: accion.estado,
                anioEstado: Number(proximaFecha(c, e.hoy).slice(0, 4)),
              }
            : c,
        ),
      };

    case "tarea/anadir": {
      const persona = e.personas.find((p) => p.id === accion.personaId && p.activa);
      const textos = partirDictado(accion.texto).filter((t) => t.length <= MAX_LARGO_ARTICULO);
      if (!persona || textos.length === 0) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, `Escribe la tarea (hasta ${MAX_LARGO_ARTICULO} caracteres).`),
        };
      }
      const ya = new Set(
        e.tareas
          .filter((t) => t.personaId === persona.id)
          .map((t) => `${t.frecuencia}|${claveArticulo(t.texto)}`),
      );
      const nuevas = textos.filter((t) => !ya.has(`${accion.frecuencia}|${claveArticulo(t)}`));
      if (nuevas.length === 0) {
        return { ...e, siguienteId: e.siguienteId + 1, aviso: ok(e, "Ya estaba en la lista.") };
      }
      return {
        ...e,
        tareas: [
          ...e.tareas,
          ...nuevas.map((texto, i) => ({
            id: idNuevo(accion.idBase, "tarea", String(i), `t-${e.siguienteId}-${i}`),
            personaId: persona.id,
            texto,
            frecuencia: accion.frecuencia,
            hechas: [],
          })),
        ],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `Añadido a ${persona.nombre}: ${nuevas.join(", ")}.`),
      };
    }

    case "tarea/alternar":
      return {
        ...e,
        tareas: e.tareas.map((t) => (t.id === accion.id ? alternarTarea(t, e.hoy) : t)),
      };

    case "tarea/borrar":
      return { ...e, tareas: e.tareas.filter((t) => t.id !== accion.id) };

    case "menu/anadir": {
      const plato = e.platos.find((p) => p.id === accion.platoId);
      const ya = comidasDe(e, accion.fecha);
      if (!plato || !fechaPlanificable(e, accion.fecha) || e.saltados.includes(accion.fecha))
        return e;
      if (ya.length >= MAX_PLATOS_POR_CENA || ya.some((c) => c.plato.id === plato.id)) return e;
      const comida: ComidaPlanificada = {
        etiqueta: `Cena del ${nombreDia(accion.fecha)}`,
        fecha: accion.fecha,
        plato,
        raciones: racionesDelHogar(e),
      };
      return {
        ...e,
        comidas: [...e.comidas, comida].sort((a, b) => a.fecha.localeCompare(b.fecha)),
        siguienteId: e.siguienteId + 1,
        aviso: ok(
          e,
          `Añadido al ${nombreDia(accion.fecha)}: ${plato.nombre}. La compra se ha actualizado.`,
        ),
      };
    }

    case "menu/quitar":
      return {
        ...e,
        comidas: e.comidas.filter(
          (c) =>
            c.fecha !== accion.fecha ||
            (accion.platoId !== undefined && c.plato.id !== accion.platoId),
        ),
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

    case "menu/nota": {
      const texto = accion.texto.replace(/\s+/g, " ").trim().slice(0, MAX_LARGO_NOTA_MENU);
      const { [accion.fecha]: _antes, ...resto } = e.notasMenu;
      void _antes;
      return { ...e, notasMenu: texto === "" ? resto : { ...resto, [accion.fecha]: texto } };
    }

    case "plato/rapido": {
      const nombre = accion.nombre.replace(/\s+/g, " ").trim();
      if (nombre.length < 2 || nombre.length > 120) {
        return {
          ...e,
          siguienteId: e.siguienteId + 1,
          aviso: error(e, "El nombre del plato necesita entre 2 y 120 letras."),
        };
      }
      const clave = normalizarNombre(nombre);
      if (e.platos.some((p) => normalizarNombre(p.nombre) === clave)) {
        return { ...e, siguienteId: e.siguienteId + 1, aviso: ok(e, `${nombre} ya estaba.`) };
      }
      // Sin ingredientes todavía: no se propone solo, pero se puede elegir a mano. Al guardarle
      // ingredientes desde «Platos» pasa a proponerse (ver `plato/guardar`).
      const nuevo: PlatoMenu = {
        id: accion.idBase ? idDePlatoRapido(accion.idBase) : `p-${e.siguienteId}`,
        nombre,
        grupo: accion.grupo,
        minutosActivos: 20,
        ingredientes: [],
        ultimaVez: null,
        valoracion: null,
        noProponer: true,
      };
      return {
        ...e,
        platos: [...e.platos, nuevo],
        siguienteId: e.siguienteId + 1,
        aviso: ok(e, `${nombre} añadido a vuestros platos. Completa sus ingredientes en «Platos».`),
      };
    }

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
        // Un plato creado «al vuelo» (sin ingredientes) empieza sin proponerse; al completarlo, sí.
        ...(existente?.noProponer && existente.ingredientes.length > 0 ? { noProponer: true } : {}),
        ...(r.valor.ligero ? { ligero: true } : {}),
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
      // Lo guardado antes de existir la agenda no la trae: se parte de una lista vacía.
      return normalizar(accion.estado);

    case "aviso/error":
      return { ...e, siguienteId: e.siguienteId + 1, aviso: error(e, accion.texto) };

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
