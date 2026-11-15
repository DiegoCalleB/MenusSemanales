import { describe, expect, it } from "vitest";
import { avisosDelEstado } from "./avisos";
import { repiteConElCole } from "./cole";
import { estadoInicialDemo } from "./datos-demo";
import type { EstadoHogar } from "./estado";
import { planDeLaSemana } from "./semana";

describe("la cena que repite lo del comedor (D-155)", () => {
  const demo = estadoInicialDemo();
  const pescado = demo.platos.find((p) => p.grupo === "pescado")!;
  const verdura = demo.platos.find((p) => p.grupo === "verdura")!;
  const hoy = demo.hoy;
  const con = (plato: typeof pescado, segundo: "pescado" | "carne" = "pescado"): EstadoHogar => ({
    ...demo,
    comidas: [{ etiqueta: "Cena", fecha: hoy, plato, raciones: 3 }],
    colegio: { [hoy]: { primero: "verdura", segundo } },
  });

  it("avisa si repite pescado, carne, legumbre o huevo; la verdura no cuenta", () => {
    expect(repiteConElCole(con(pescado), hoy)).toEqual({ plato: pescado.nombre, grupo: "pescado" });
    expect(repiteConElCole(con(pescado, "carne"), hoy)).toBeNull();
    // El primero del cole es verdura: cenar verdura no es «repetir».
    expect(repiteConElCole(con(verdura), hoy)).toBeNull();
  });

  it("sale en la campanita y en el plan de la semana", () => {
    const e = con(pescado);
    expect(avisosDelEstado(e).find((a) => a.id === `cole-repite-${hoy}`)?.titulo).toBe(
      `La cena de hoy (${pescado.nombre}) repite pescado con el comedor`,
    );
    expect(planDeLaSemana(e).dias.find((d) => d.fecha === hoy)?.repiteCole).toEqual({
      plato: pescado.nombre,
      grupo: "pescado",
    });
  });

  it("si lo del mediodía se comió en casa, no es el comedor", () => {
    const e = con(pescado);
    const enCasa = { ...e, colegio: { [hoy]: { ...e.colegio[hoy]!, origen: "casa" as const } } };
    expect(repiteConElCole(enCasa, hoy)).toBeNull();
  });
});
