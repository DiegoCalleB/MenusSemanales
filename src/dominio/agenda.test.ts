import { describe, expect, it } from "vitest";
import { parsearAgenda, resumenApunte } from "./agenda";

const HOY = "2026-11-02";
const leer = (t: string) =>
  parsearAgenda(t, HOY).conFecha.map((a) => [a.fecha, a.hora, a.titulo, a.hasta]);

describe("parsearAgenda", () => {
  it("entiende «día mes texto» con la próxima vez que cae", () => {
    expect(leer("17 Marzo Excursiones Alba concierto\n7 de noviembre Cumple Ana")).toEqual([
      ["2027-03-17", null, "Excursiones Alba concierto", null],
      ["2026-11-07", null, "Cumple Ana", null],
    ]);
  });

  it("lee la hora, los rangos, el año y las fechas con barras", () => {
    expect(
      leer(
        "1 Junio 8:00 Midas\n17-19 Abril Familias de Puente\n3 enero 2028 Algo\n12/3 Dentista\n5/9/27 Cole",
      ),
    ).toEqual([
      ["2027-06-01", "08:00", "Midas", null],
      ["2027-04-17", null, "Familias de Puente", "2027-04-19"],
      ["2028-01-03", null, "Algo", null],
      ["2027-03-12", null, "Dentista", null],
      ["2027-09-05", null, "Cole", null],
    ]);
  });

  it("ignora casillas y viñetas, perdona erratas en el mes y deja lo sin fecha como tarea", () => {
    const r = parsearAgenda(
      "[X] 23 Septimembre 19:00 Láser\n[ ] Veterinario Punky!!!\n- 17 Inscripción taller\n[X] \n[ ]\n* 4 sept. Lluvia",
      HOY,
    );
    expect(r.conFecha.map((a) => [a.fecha, a.hora, a.titulo])).toEqual([
      ["2027-09-23", "19:00", "Láser"],
      ["2027-09-04", null, "Lluvia"],
    ]);
    expect(r.sinFecha).toEqual(["Veterinario Punky!!!", "17 Inscripción taller"]);
    expect(r.erroneos).toEqual([]);
  });

  it("señala lo que parece fecha pero no vale", () => {
    const r = parsearAgenda(
      "31 Abril Mal\n30/2 Mal\n5 Mayo 25:00 Hora\n18 Mayo\n19-17 Mayo Al revés",
      HOY,
    );
    expect(r.conFecha).toEqual([]);
    expect(r.erroneos).toEqual([
      "31 Abril Mal",
      "30/2 Mal",
      "5 Mayo 25:00 Hora",
      "18 Mayo",
      "19-17 Mayo Al revés",
    ]);
  });

  it("el 29 de febrero cae el 28 si el año no es bisiesto, y se enseña en una línea", () => {
    expect(leer("29 febrero Bici")[0]?.[0]).toBe("2027-02-28");
    expect(
      resumenApunte({ fecha: "2027-04-17", hasta: "2027-04-19", hora: "08:00", titulo: "Puente" }),
    ).toBe("Puente · 08:00 (hasta el 19)");
  });
});
