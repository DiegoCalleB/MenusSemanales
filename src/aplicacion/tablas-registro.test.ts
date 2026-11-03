import { describe, expect, it } from "vitest";
import type { FechaIso } from "@/dominio/fechas";
import { idDeEntrada } from "@/dominio/registro";
import { adaptadorRegistro } from "./adaptadores-tablas";
import { estadoInicialDemo } from "./datos-demo";
import {
  type LecturaRegistro,
  aplicarCambiosALecturaRegistro,
  aplicarLecturaDeRegistro,
  diferenciasRegistro,
  leerRegistro,
  lecturaDeRegistro,
} from "./tablas-registro";

const base = estadoInicialDemo();
const p = base.personas[0]!.id;
const entrada = (que: string, fecha: string = base.hoy) => ({
  id: idDeEntrada(fecha as FechaIso, que, p),
  fecha: fecha as FechaIso,
  que,
  personaId: p,
});

describe("lo de hoy en tablas", () => {
  it("no hay diferencias si no cambia nada", () => {
    expect(diferenciasRegistro(base, base)).toBeNull();
  });

  it("apuntar y quitar se traducen a upsert y borrar por id", () => {
    const con = { ...base, registro: [entrada("Cena")] };
    expect(diferenciasRegistro(base, con)).toEqual({ upsert: [entrada("Cena")] });
    expect(diferenciasRegistro(con, base)).toEqual({ borrar: [entrada("Cena").id] });
  });

  it("escribir y leer deja el registro idéntico y ordenado por fecha", () => {
    const e = {
      ...base,
      registro: [entrada("Cena", "2026-11-03"), entrada("Gatos", "2026-11-02")],
    };
    const lectura = aplicarCambiosALecturaRegistro(
      { filas: [] },
      diferenciasRegistro(base, e) ?? {},
    );
    const leido = aplicarLecturaDeRegistro(base, leerRegistro(JSON.parse(JSON.stringify(lectura))));
    expect(leido.registro.map((r) => r.que)).toEqual(["Gatos", "Cena"]);
    expect(lecturaDeRegistro(leido).filas).toHaveLength(2);
  });

  it("la mezcla de cambios añade y quita sin tocar el resto", () => {
    const l: LecturaRegistro = { filas: [entrada("Cena"), entrada("Compra")] };
    const r = aplicarCambiosALecturaRegistro(l, {
      upsert: [entrada("Gatos")],
      borrar: [entrada("Cena").id],
    });
    expect(r.filas.map((f) => f.que).sort()).toEqual(["Compra", "Gatos"]);
  });

  it("el adaptador siempre manda la tabla (nace en tablas, no hay nada que importar)", () => {
    expect(adaptadorRegistro.hayDatos({ filas: [] })).toBe(true);
    expect(adaptadorRegistro.huella({ ...base, registro: [entrada("Cena")] })).not.toBe(
      adaptadorRegistro.huella(base),
    );
  });

  it("una lectura mal formada se rechaza", () => {
    expect(() => leerRegistro({ filas: [{ id: 1 }] })).toThrow();
  });
});
