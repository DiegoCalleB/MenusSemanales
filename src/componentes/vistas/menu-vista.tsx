"use client";

import Link from "next/link";
import { useMemo } from "react";
import { diasDelMenu, menuDeLaSemana, nombreDia } from "@/aplicacion/estado";
import type { Motivo, Opcion } from "@/dominio/menu";
import { IconoReloj } from "../iconos";
import { useHogar } from "../proveedor-hogar";

const TEXTO_MOTIVO: Record<Motivo, string> = {
  usa_caducidad: "Gasta lo que caduca",
  usa_despensa: "Ya tenéis ingredientes",
  bien_valorado: "Os gusta",
  hace_tiempo: "Hace tiempo que no lo coméis",
  novedad: "Nuevo para vosotros",
  rapido: "Rápido",
};

const NOMBRE_GRUPO: Record<string, string> = {
  carne: "carne",
  pescado: "pescado",
  legumbre: "legumbres",
  huevo: "huevos",
  pasta: "pasta",
  arroz: "arroz",
  verdura: "verdura",
  otro: "otro",
};

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function MenuVista() {
  const { estado, despachar } = useHogar();
  const dias = useMemo(() => diasDelMenu(estado), [estado]);
  const propuesta = useMemo(() => menuDeLaSemana(estado), [estado]);
  const eleccion = (fecha: string) => estado.comidas.find((c) => c.fecha === fecha);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Menú de la semana</h1>
        <p className="text-tinta-suave max-w-prose text-base">
          Para cada cena, unas pocas opciones que encajan con el tiempo de ese día y con el menú del
          cole. Elegid la que más os cuadre y la lista de la compra se actualiza sola.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Cuánto planificar" className="flex gap-2">
          {(
            [
              ["semana", "Esta semana"],
              ["quincena", "Próximos 15 días"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={estado.horizonte === valor}
              className={estado.horizonte === valor ? "boton" : "boton-suave"}
              onClick={() => despachar({ tipo: "menu/horizonte", horizonte: valor })}
            >
              {texto}
            </button>
          ))}
        </div>
        <Link href="/menu/cole" className="boton-suave">
          Menú del cole
        </Link>
      </div>
      {estado.horizonte === "quincena" && (
        <p className="text-tinta-suave max-w-prose text-base">
          Eligiendo varias cenas puedes adelantar la compra de 15 días: la lista suma lo de todas.
        </p>
      )}

      <ul className="grid gap-4 lg:grid-cols-2">
        {dias.map((dia) => {
          const elegida = eleccion(dia.fecha);
          const opciones: Opcion[] = elegida
            ? (menuDeLaSemana(estado, dia.fecha)
                .dias.find((d) => d.fecha === dia.fecha)
                ?.opciones.filter((o) => o.plato.id !== elegida.plato.id) ?? [])
            : (propuesta.dias.find((d) => d.fecha === dia.fecha)?.opciones ?? []);
          const tarde = estado.llegoTarde.includes(dia.fecha);
          const titulo = `${mayuscula(nombreDia(dia.fecha))} ${formatoFecha.format(new Date(`${dia.fecha}T00:00:00Z`))}`;
          return (
            <li key={dia.fecha} className="tarjeta flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{titulo}</h2>
                  <p className="text-tinta-suave flex items-center gap-1.5 text-base">
                    <IconoReloj width={18} height={18} />
                    Hasta {dia.minutosMax} min
                    {dia.cole &&
                      ` · en el cole: ${[dia.cole.primero, dia.cole.segundo]
                        .filter(Boolean)
                        .map((g) => NOMBRE_GRUPO[g as string])
                        .join(" y ")}`}
                  </p>
                  {dia.cole?.textoPrimero && (
                    <p className="text-tinta-suave mt-1 text-sm">
                      Cole: {dia.cole.textoPrimero}
                      {dia.cole.textoSegundo && ` / ${dia.cole.textoSegundo}`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-pressed={tarde}
                  onClick={() => despachar({ tipo: "menu/llegoTarde", fecha: dia.fecha })}
                  className={tarde ? "boton" : "boton-suave"}
                >
                  Hoy llego tarde
                </button>
              </div>

              {elegida && (
                <div className="bg-marca/10 border-marca/30 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="text-tinta-suave text-sm font-medium">Elegido</p>
                    <p className="text-lg font-semibold">{elegida.plato.nombre}</p>
                  </div>
                  <button
                    type="button"
                    className="boton-suave"
                    onClick={() => despachar({ tipo: "menu/quitar", fecha: dia.fecha })}
                  >
                    Quitar
                  </button>
                </div>
              )}

              {opciones.length === 0 && !elegida && (
                <p className="text-tinta-suave text-base">
                  Ningún plato cumple las reglas de este día (tiempo, cole o ingredientes). Prueba a
                  quitar «Hoy llego tarde» o a añadir platos al catálogo.
                </p>
              )}

              {opciones.length > 0 && (
                <section aria-label={`Opciones para el ${nombreDia(dia.fecha)}`}>
                  <h3 className="text-tinta-suave mb-2 text-sm font-semibold">
                    {elegida ? "Otras opciones" : "Opciones"}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {opciones.map((o) => (
                      <li
                        key={o.plato.id}
                        className="border-borde flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold">{o.plato.nombre}</p>
                          <p className="text-tinta-suave text-sm">
                            {o.plato.minutosActivos} min · {NOMBRE_GRUPO[o.plato.grupo]}
                          </p>
                          {o.motivos.length > 0 && (
                            <ul className="mt-1 flex flex-wrap gap-1.5">
                              {o.motivos.map((m) => (
                                <li key={m} className="etiqueta bg-fondo text-tinta">
                                  {TEXTO_MOTIVO[m]}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button
                          type="button"
                          className="boton"
                          aria-label={`${elegida ? "Cambiar por" : "Elegir"} ${o.plato.nombre}`}
                          onClick={() =>
                            despachar({
                              tipo: "menu/elegir",
                              fecha: dia.fecha,
                              platoId: o.plato.id,
                            })
                          }
                        >
                          {elegida ? "Cambiar" : "Elegir"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
