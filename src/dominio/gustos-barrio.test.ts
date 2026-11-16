import { describe, expect, it } from "vitest";
import type { PlanBarrio } from "./barrio";
import { afinidad, conVoto, pesosDeGusto, rasgosDelPlan, UMBRAL_ME_PEGA } from "./gustos-barrio";

const plan = (o: Partial<PlanBarrio> = {}): PlanBarrio => ({
  id: "1",
  fecha: "2026-11-21", // sábado
  hasta: null,
  hora: "11:15",
  titulo: "Taller de cajas mágicas",
  lugar: "Espacio Abierto Quinta de los Molinos",
  barrio: "Rosas",
  gratis: false,
  precio: "5 euros",
  enlace: null,
  familiar: true,
  serie: false,
  emoji: "🎨",
  ...o,
});

describe("gustos de planes del barrio (D-171)", () => {
  it("saca rasgos del plan: tipo, sitio, familia, momento, cuándo y palabras", () => {
    const r = rasgosDelPlan(plan());
    expect(r).toEqual(
      expect.arrayContaining([
        "tipo:🎨",
        "lugar:espacio abierto quinta de los molinos",
        "familia",
        "momento:mañana",
        "cuando:finde",
        "palabra:cajas",
        "palabra:magicas",
      ]),
    );
    expect(r).not.toContain("gratis");
    expect(r).not.toContain("palabra:taller");
  });

  it("sin votos no hay afinidad; con votos, lo parecido sube y lo contrario baja", () => {
    const sinVotos = afinidad(rasgosDelPlan(plan()), pesosDeGusto([]));
    expect(sinVotos).toEqual({ puntos: 0, motivo: null });

    let votos = conVoto([], { id: "a", rasgos: rasgosDelPlan(plan({ id: "a" })), voto: 1 });
    votos = conVoto(votos, {
      id: "b",
      rasgos: rasgosDelPlan(
        plan({
          id: "b",
          lugar: "Centro Cultural X",
          emoji: "🎵",
          titulo: "Concierto de jazz",
          familiar: false,
        }),
      ),
      voto: -1,
    });
    const pesos = pesosDeGusto(votos);
    const parecido = afinidad(
      rasgosDelPlan(plan({ id: "c", titulo: "Taller de cerámica" })),
      pesos,
    );
    const distinto = afinidad(
      rasgosDelPlan(
        plan({
          id: "d",
          lugar: "Centro Cultural X",
          emoji: "🎵",
          familiar: false,
          titulo: "Concierto de jazz",
        }),
      ),
      pesos,
    );
    expect(parecido.puntos).toBeGreaterThan(distinto.puntos);
    expect(parecido.puntos).toBeGreaterThan(UMBRAL_ME_PEGA);
    expect(distinto.puntos).toBeLessThan(0);
    expect(parecido.motivo).toContain("Quinta");
  });

  it("un voto repetido sustituye al anterior, y 0 lo quita", () => {
    const r = ["familia"];
    let v = conVoto([], { id: "a", rasgos: r, voto: 1 });
    v = conVoto(v, { id: "a", rasgos: r, voto: -1 });
    expect(v).toEqual([{ id: "a", rasgos: r, voto: -1 }]);
    expect(conVoto(v, { id: "a", rasgos: r, voto: 0 })).toEqual([]);
  });

  it("guarda como mucho 150 votos (los más antiguos se olvidan)", () => {
    let v: ReturnType<typeof conVoto> = [];
    for (let i = 0; i < 160; i++) v = conVoto(v, { id: `p${i}`, rasgos: ["familia"], voto: 1 });
    expect(v).toHaveLength(150);
    expect(v[0]?.id).toBe("p10");
  });
});
