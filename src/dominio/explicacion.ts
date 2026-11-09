import { type Componente, SUGERENCIA_COMPONENTE } from "./componentes";
import { KCAL_CONTUNDENTE, KCAL_LIGERO, LIGEROS } from "./compatibilidad";
import { estadoDelGrupo } from "./equilibrio";
import { type FechaIso, diasEntre } from "./fechas";
import {
  type DiaMenu,
  type GrupoPlato,
  type Motivo,
  type PlatoMenu,
  recomendacionesPorPlato,
} from "./menu";
import { formatearLista } from "./texto";

/**
 * Explica POR QUÉ se recomienda una cena y no otra, en lenguaje de persona y con datos reales: lo
 * que comieron las niñas en el cole, el equilibrio de la semana, el tiempo, lo que caduca y lo que
 * os gusta. Es determinista (D-041): cada frase sale de un dato y no puede inventar nada. Una IA
 * podrá redactarlo más suave, pero solo a partir de estas mismas razones.
 */

const GRUPO: Record<GrupoPlato, string> = {
  verdura: "verdura",
  legumbre: "legumbres",
  pasta: "pasta",
  arroz: "arroz",
  pescado: "pescado",
  carne: "carne",
  huevo: "huevo",
  otro: "otro tipo de plato",
};

export interface ExplicacionOpcion {
  /** Una frase con la razón principal. */
  resumen: string;
  /** Todas las razones, de más a menos importante. */
  lineas: string[];
}

export function explicarOpcion(args: {
  plato: PlatoMenu;
  motivos: readonly Motivo[];
  dia: DiaMenu;
  hoy: FechaIso;
  /** Veces que ha aparecido cada grupo esta semana (cole + cenas), sin esta cena. */
  semana: Readonly<Partial<Record<GrupoPlato, number>>>;
  /** Ingredientes de este plato que caducan pronto, con su nombre y fecha. */
  caducan: ReadonlyArray<{ nombre: string; caducaEn: FechaIso }>;
  /** Componentes de la «regla de oro» que el plato no aporta por sí solo. */
  faltan?: readonly Componente[];
}): ExplicacionOpcion {
  const { plato, motivos, dia, hoy, semana, caducan, faltan = [] } = args;
  const lineas: string[] = [];
  const cole = dia.cole;
  const gp = GRUPO[plato.grupo];

  // 1. Lo que comieron las niñas y qué recomienda el cole para la cena.
  let resumen = "";
  if (cole && (cole.primero || cole.segundo)) {
    const verbo = dia.fecha === hoy ? "han comido" : dia.fecha < hoy ? "comieron" : "comerán";
    const comido = formatearLista(
      [cole.primero, cole.segundo].filter((g): g is GrupoPlato => g !== null).map((g) => GRUPO[g]),
    );
    if (cole.origen === "casa") {
      // Una comida de casa apuntada a mano (fin de semana, fiesta…), no el menú del cole.
      const sujeto =
        dia.fecha === hoy
          ? "Hoy habéis comido"
          : dia.fecha < hoy
            ? "Ese día comisteis"
            : "Ese día comeréis";
      resumen = `${sujeto} ${comido} en casa; para compensar, ${plato.nombre} (${gp}).`;
    } else {
      resumen = `Hoy las niñas ${verbo} ${comido} en el cole; para compensar, ${plato.nombre} (${gp}).`;
      if (dia.fecha !== hoy) resumen = resumen.replace("Hoy las niñas", "Ese día las niñas");
    }
    const r = recomendacionesPorPlato(cole);
    const apoyos: string[] = [];
    if (cole.primero && r.trasPrimero.includes(plato.grupo)) {
      apoyos.push(
        `tras ${GRUPO[cole.primero]} de primero, el recomendador aconseja ${formatearLista(r.trasPrimero.map((g) => GRUPO[g]))}`,
      );
    }
    if (cole.segundo && r.trasSegundo.includes(plato.grupo)) {
      apoyos.push(
        `tras ${GRUPO[cole.segundo]} de segundo, aconseja ${formatearLista(r.trasSegundo.map((g) => GRUPO[g]))}`,
      );
    }
    if (apoyos.length > 0) {
      lineas.push(
        `Encaja con ${cole.origen === "casa" ? "la comida" : "el cole"}: ${apoyos.join("; ")} (${plato.grupo === "otro" ? "este plato" : gp} lo cumple).`,
      );
    }
    if (cole.kcal != null && cole.kcal >= KCAL_CONTUNDENTE && LIGEROS.includes(plato.grupo)) {
      lineas.push(
        `El menú del cole fue contundente (${cole.kcal} kcal): una cena ligera lo equilibra.`,
      );
    } else if (cole.kcal != null && cole.kcal <= KCAL_LIGERO && !LIGEROS.includes(plato.grupo)) {
      lineas.push(
        `El menú del cole fue ligero (${cole.kcal} kcal): esta cena es algo más completa.`,
      );
    }
  }

  // 2. Equilibrio de la semana, cole y cenas juntos.
  const eq = estadoDelGrupo(plato.grupo, semana);
  if (eq) {
    const { n, objetivo } = eq;
    const rango = `${objetivo.min}–${objetivo.max}`;
    if (eq.estado === "falta") {
      lineas.push(
        `Esta semana llevan ${n} de ${objetivo.nombre} entre cole y cenas y lo recomendado son ${rango}: esta cena ayuda a llegar.`,
      );
      if (!resumen)
        resumen = `Esta semana os falta ${objetivo.nombre} (${n} de ${rango}): ${plato.nombre} ayuda a completarlo.`;
    } else if (eq.estado === "completo") {
      lineas.push(
        `Ojo: ya llevan ${n} de ${objetivo.nombre} esta semana (máximo orientativo ${objetivo.max}); esta sumaría una más.`,
      );
    } else {
      lineas.push(
        `Esta semana llevan ${n} de ${objetivo.nombre}: con esta serían ${n + 1}, dentro de lo recomendado (${rango}).`,
      );
    }
  }

  // 3. Tiempo.
  if (dia.minutosMax <= 15) {
    lineas.push(
      `Son ${plato.minutosActivos} min de trabajo: ideal para un día de prisas (máximo ${dia.minutosMax} min).`,
    );
    if (!resumen) resumen = `Para un día de prisas: ${plato.minutosActivos} min de trabajo.`;
  } else {
    lineas.push(
      `${plato.minutosActivos} min de trabajo, dentro de los ${dia.minutosMax} min de ese día.`,
    );
  }

  // 4. Caducidad, despensa, gusto y novedad.
  if (motivos.includes("usa_caducidad") && caducan.length > 0) {
    const c = caducan[0];
    const dias = c ? diasEntre(hoy, c.caducaEn) : 0;
    const cuando =
      dias <= 0 ? "caduca hoy" : dias === 1 ? "caduca mañana" : `caduca en ${dias} días`;
    lineas.push(`Gasta ${formatearLista(caducan.map((x) => x.nombre))}, que ${cuando}.`);
    if (!resumen)
      resumen = `Gasta ${caducan[0]?.nombre ?? "lo que caduca"} antes de que se estropee.`;
  }
  if (motivos.includes("usa_despensa"))
    lineas.push("Ya tenéis en casa la mayoría de los ingredientes.");
  if (motivos.includes("bien_valorado") && plato.valoracion !== null) {
    lineas.push(`Es de los que más os gustan (★ ${String(plato.valoracion).replace(".", ",")}).`);
    if (!resumen) resumen = `Es de los que más os gustan: ${plato.nombre}.`;
  }
  if (motivos.includes("hace_tiempo") && plato.ultimaVez) {
    lineas.push(
      `Hace ${diasEntre(plato.ultimaVez, dia.fecha)} días que no lo cenáis: así se varía.`,
    );
  }
  if (motivos.includes("novedad")) lineas.push("Aún no lo habéis cenado desde que usáis la app.");
  // 5. Cómo completar la cena (regla de oro) y el postre que recomienda el cole.
  if (faltan.length > 0) {
    lineas.push(
      `Para que sea una cena completa, añadid ${formatearLista(faltan.map((c) => SUGERENCIA_COMPONENTE[c]))}.`,
    );
  }
  if (cole && (cole.primero || cole.segundo)) {
    lineas.push("De postre, como aconseja el cole: fruta o un lácteo.");
  }
  if (!resumen) resumen = `${plato.nombre} es una buena opción para ese día.`;

  return { resumen, lineas };
}
