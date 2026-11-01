"use client";

import { diasDelMenu, nombreDia, nombreMes } from "@/aplicacion/estado";
import type { FechaIso } from "@/dominio/fechas";
import { type GrupoPlato, type MenuCole, recomendadosParaCenar } from "@/dominio/menu";
import { EMOJI_GRUPO } from "./formato";
import { useHogar } from "./proveedor-hogar";

const NOMBRE_GRUPO: Record<GrupoPlato, string> = {
  verdura: "verdura",
  legumbre: "legumbres",
  pasta: "pasta",
  arroz: "arroz",
  pescado: "pescado",
  carne: "carne",
  huevo: "huevo",
  otro: "otro",
};
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const fechaCorta = (f: FechaIso) =>
  `${mayuscula(nombreDia(f))} ${Number(f.slice(8))} de ${nombreMes(f)}`;

function Plato({
  n,
  texto,
  grupo,
}: {
  n: string;
  texto?: string | null;
  grupo: GrupoPlato | null;
}) {
  if (!texto && !grupo) return null;
  return (
    <p className="text-base">
      <span className="font-bold">{n}</span>{" "}
      <span aria-hidden="true">{grupo ? EMOJI_GRUPO[grupo] : ""} </span>
      {texto ?? (grupo ? NOMBRE_GRUPO[grupo] : "")}
    </p>
  );
}

/** Lo que han comido las niñas en el cole ese día, de un vistazo, y qué conviene cenar. */
export function TarjetaCole({ cole, fecha }: { cole: MenuCole | null; fecha: FechaIso }) {
  const recomendados = recomendadosParaCenar(cole);
  return (
    <section
      aria-label={`Menú del cole del ${fechaCorta(fecha)}`}
      className="bg-suave-3 flex flex-col gap-1 rounded-2xl p-3"
    >
      <h3 className="text-base font-extrabold">
        <span aria-hidden="true">🎒 </span>En el cole
      </h3>
      {cole && (cole.primero || cole.segundo || cole.textoPrimero || cole.textoSegundo) ? (
        <>
          <Plato n="1º" texto={cole.textoPrimero} grupo={cole.primero} />
          <Plato n="2º" texto={cole.textoSegundo} grupo={cole.segundo} />
          {(cole.guarnicion || cole.postre || cole.kcal) && (
            <p className="text-tinta-suave text-sm">
              {[cole.guarnicion, cole.postre, cole.kcal ? `${cole.kcal} kcal` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {recomendados && (
            <p className="mt-1 text-base">
              <span className="font-bold">Para cenar conviene:</span>{" "}
              {[...recomendados].map((g) => (
                <span key={g} className="mr-2 whitespace-nowrap">
                  <span aria-hidden="true">{EMOJI_GRUPO[g]} </span>
                  {NOMBRE_GRUPO[g]}
                </span>
              ))}
            </p>
          )}
        </>
      ) : (
        <p className="text-tinta-suave text-base">Sin menú del cole este día.</p>
      )}
    </section>
  );
}

/** Cole y cena de cada día, uno debajo de otro: para contrastarlos de un vistazo. */
export function ColeVsCena() {
  const { estado } = useHogar();
  const dias = diasDelMenu(estado).filter(
    (d) => estado.colegio[d.fecha] || estado.comidas.some((c) => c.fecha === d.fecha),
  );
  return (
    <section className="tarjeta flex flex-col gap-3" aria-labelledby="cole-vs-cena">
      <h2 id="cole-vs-cena" className="text-xl font-extrabold">
        Cole y cena, de un vistazo
      </h2>
      <ul className="flex flex-col gap-2">
        {dias.map((d) => {
          const cole = estado.colegio[d.fecha];
          const cena = estado.comidas.find((c) => c.fecha === d.fecha);
          const grupoCena = (cena?.plato as { grupo?: GrupoPlato } | undefined)?.grupo;
          const grupos = [cole?.primero, cole?.segundo].filter((g): g is GrupoPlato => !!g);
          return (
            <li key={d.fecha} className="border-borde bg-fondo rounded-2xl border p-3">
              <p className="text-base font-extrabold">{fechaCorta(d.fecha)}</p>
              <p className="text-base">
                <span aria-hidden="true">🎒 </span>
                <span className="sr-only">Cole: </span>
                {cole
                  ? [cole.textoPrimero, cole.textoSegundo].filter(Boolean).join(" / ") ||
                    grupos.map((g) => NOMBRE_GRUPO[g]).join(" y ")
                  : "sin menú"}
                {grupos.length > 0 && (
                  <span aria-hidden="true"> {grupos.map((g) => EMOJI_GRUPO[g]).join(" ")}</span>
                )}
              </p>
              <p className="text-base font-semibold">
                <span aria-hidden="true">🍽️ </span>
                <span className="sr-only">Cena: </span>
                {cena ? (
                  <>
                    {cena.plato.nombre}
                    <span aria-hidden="true"> {grupoCena ? EMOJI_GRUPO[grupoCena] : ""}</span>
                  </>
                ) : (
                  <span className="text-tinta-suave font-normal">sin cena elegida</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
