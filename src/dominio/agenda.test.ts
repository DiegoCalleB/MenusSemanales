import { describe, expect, it } from "vitest";
import { enlaceGoogleCalendar, parsearAgenda, resumenApunte, textoParaKeep } from "./agenda";

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

describe("llevar los apuntes a Keep y al calendario", () => {
  it("el texto para Keep se puede volver a pegar y da lo mismo, con año solo cuando hace falta", () => {
    const original = parsearAgenda(
      "1 Junio 8:00 Midas\n17-19 Abril Familias de Puente\n7 Noviembre Cumple Ana\n3 enero 2028 Lejos",
      HOY,
    ).conFecha;
    const texto = textoParaKeep(original, HOY);
    expect(texto).toBe(
      [
        "7 Noviembre Cumple Ana",
        "17-19 Abril Familias de Puente",
        "1 Junio 08:00 Midas",
        "3 Enero 2028 Lejos",
      ].join("\n"),
    );
    expect(
      parsearAgenda(texto, HOY).conFecha.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    ).toEqual([...original].sort((a, b) => a.fecha.localeCompare(b.fecha)));
  });

  it("el enlace de Google Calendar sirve para todo el día, con hora, varios días y anual", () => {
    const base = { fecha: "2026-11-05", titulo: "Excursión Alba & Emma" };
    expect(enlaceGoogleCalendar(base)).toBe(
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Excursi%C3%B3n+Alba+%26+Emma&dates=20261105%2F20261106",
    );
    const conHora = enlaceGoogleCalendar({ ...base, hora: "18:15" });
    expect(conHora).toContain("dates=20261105T181500%2F20261105T191500");
    expect(conHora).toContain("ctz=Europe%2FMadrid");
    expect(enlaceGoogleCalendar({ ...base, hasta: "2026-11-07" })).toContain(
      "dates=20261105%2F20261108",
    );
    expect(enlaceGoogleCalendar({ ...base, anual: true })).toContain("recur=RRULE%3AFREQ%3DYEARLY");
    expect(enlaceGoogleCalendar({ ...base, hora: "23:15" })).toContain("T231500%2F20261105T235900");
  });
});
