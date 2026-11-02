import { describe, expect, it } from "vitest";
import { parsearIcs } from "./ics";

const cal = (...eventos: string[]) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${eventos.map((e) => `BEGIN:VEVENT\r\n${e}\r\nEND:VEVENT\r\n`).join("")}END:VCALENDAR`;
const DESDE = "2026-11-02";
const HASTA = "2026-12-02";
const lista = (ics: string) =>
  parsearIcs(ics, DESDE, HASTA).map((e) => [e.fecha, e.titulo, e.hora]);

describe("parsearIcs", () => {
  it("lee eventos de día completo y con hora, y se queda con los del rango", () => {
    expect(
      lista(
        cal(
          "UID:1\r\nDTSTART;VALUE=DATE:20261107\r\nSUMMARY:Cumple de Ana\\, 42",
          "UID:2\r\nDTSTART;TZID=Europe/Madrid:20261110T183000\r\nSUMMARY:Dentista",
          "UID:3\r\nDTSTART:20261110T213000Z\r\nSUMMARY:Cine",
          "UID:4\r\nDTSTART;VALUE=DATE:20270101\r\nSUMMARY:Lejos",
          "UID:5\r\nDTSTART;VALUE=DATE:20261001\r\nSUMMARY:Pasado",
        ),
      ),
    ).toEqual([
      ["2026-11-07", "Cumple de Ana, 42", null],
      ["2026-11-10", "Dentista", "18:30"],
      ["2026-11-10", "Cine", "22:30"],
    ]);
  });

  it("une líneas partidas, descarta cancelados y pasa la hora universal a la de Madrid (cambia el día)", () => {
    expect(
      lista(
        cal(
          "UID:1\r\nDTSTART:20261110T233000Z\r\nSUMMARY:Cena la\r\n rga",
          "UID:2\r\nDTSTART;VALUE=DATE:20261108\r\nSUMMARY:Anulado\r\nSTATUS:CANCELLED",
        ),
      ),
    ).toEqual([["2026-11-11", "Cena larga", "00:30"]]);
  });

  it("repite semanal, anual y mensual, respeta excepciones, UNTIL y COUNT", () => {
    const r = lista(
      cal(
        "UID:s\r\nDTSTART;VALUE=DATE:20261002\r\nRRULE:FREQ=WEEKLY\r\nEXDATE;VALUE=DATE:20261113\r\nSUMMARY:Piscina",
        "UID:a\r\nDTSTART;VALUE=DATE:19841120\r\nRRULE:FREQ=YEARLY\r\nSUMMARY:Aniversario",
        "UID:m\r\nDTSTART;VALUE=DATE:20260115\r\nRRULE:FREQ=MONTHLY;COUNT=12\r\nSUMMARY:Recibo",
        "UID:u\r\nDTSTART;VALUE=DATE:20261001\r\nRRULE:FREQ=DAILY;UNTIL=20261103\r\nSUMMARY:Pastilla",
      ),
    );
    expect(r.filter((x) => x[1] === "Piscina").map((x) => x[0])).toEqual([
      "2026-11-06",
      "2026-11-20",
      "2026-11-27",
    ]);
    expect(r.filter((x) => x[1] === "Aniversario").map((x) => x[0])).toEqual(["2026-11-20"]);
    expect(r.filter((x) => x[1] === "Recibo").map((x) => x[0])).toEqual(
      ["2026-11-15", "2026-12-15"].slice(0, 1),
    );
    expect(r.filter((x) => x[1] === "Pastilla").map((x) => x[0])).toEqual([
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("una modificación de un día sustituye a la repetición y un evento de varios días sale una vez (el primer día que queda)", () => {
    const r = lista(
      cal(
        "UID:s\r\nDTSTART;VALUE=DATE:20261105\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nSUMMARY:Judo",
        "UID:s\r\nRECURRENCE-ID;VALUE=DATE:20261112\r\nDTSTART;VALUE=DATE:20261113\r\nSUMMARY:Judo (cambiado)",
        "UID:v\r\nDTSTART;VALUE=DATE:20261030\r\nDTEND;VALUE=DATE:20261104\r\nSUMMARY:Puente",
      ),
    );
    expect(r).toEqual([
      ["2026-11-02", "Puente", null],
      ["2026-11-05", "Judo", null],
      ["2026-11-13", "Judo (cambiado)", null],
    ]);
  });

  it("ignora basura sin romperse", () => {
    expect(parsearIcs("", DESDE, HASTA)).toEqual([]);
    expect(
      lista(cal("UID:x\r\nSUMMARY:Sin fecha", "UID:y\r\nDTSTART:raro\r\nSUMMARY:Rara")),
    ).toEqual([]);
  });
});
