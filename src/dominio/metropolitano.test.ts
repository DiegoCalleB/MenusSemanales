import { describe, expect, it } from "vitest";
import {
  eventosDeTicketmaster,
  juntarEventos,
  partidosEnCasa,
  planesDelDia,
  textoDelEvento,
  tituloCortoDelEvento,
} from "./metropolitano";

/** Recortes de respuestas reales de ESPN (15-11-2026). */
const partido = (
  id: string,
  date: string,
  local: [string, string],
  visitante: [string, string],
  estadio: string,
  timeValid = true,
  slug = "esp.1",
) => ({
  id,
  date,
  timeValid,
  league: { slug },
  competitions: [
    {
      venue: { fullName: estadio },
      competitors: [
        { homeAway: "home", team: { id: local[0], displayName: local[1] } },
        { homeAway: "away", team: { id: visitante[0], displayName: visitante[1] } },
      ],
    },
  ],
});
const ATM: [string, string] = ["1068", "Atlético Madrid"];
const ESPN = {
  events: [
    partido("1", "2026-11-22T20:00Z", ["2922", "Getafe"], ATM, "Estadio Coliseum"),
    partido("2", "2026-12-06T20:00Z", ATM, ["244", "Real Betis"], "Riyadh Air Metropolitano"),
    partido("3", "2026-12-13T20:00Z", ATM, ["94", "Valencia"], "Riyadh Air Metropolitano", false),
    partido(
      "4",
      "2026-11-25T20:00Z",
      ATM,
      ["510", "Viking FK"],
      "Riyadh Air Metropolitano",
      true,
      "uefa.champions",
    ),
  ],
};

describe("el Metropolitano (D-159)", () => {
  it("solo los partidos en casa, en hora de Madrid, y sin hora si aún no está confirmada", () => {
    expect(partidosEnCasa(ESPN, "esp.1")).toEqual([
      {
        id: "partido-2",
        fecha: "2026-12-06",
        hora: "21:00",
        tipo: "partido",
        titulo: "Atlético – Real Betis (Liga)",
      },
      {
        id: "partido-3",
        fecha: "2026-12-13",
        hora: null,
        tipo: "partido",
        titulo: "Atlético – Valencia (Liga)",
      },
      {
        id: "partido-4",
        fecha: "2026-11-25",
        hora: "21:00",
        tipo: "partido",
        titulo: "Atlético – Viking FK (Champions)",
      },
    ]);
  });

  it("la selección en el Metropolitano también cuenta, con los nombres en español", () => {
    const seleccion = {
      events: [
        partido(
          "7",
          "2026-11-15T19:45Z",
          ["164", "Spain"],
          ["448", "England"],
          "Riyadh Air Metropolitano",
          true,
          "uefa.nations",
        ),
        partido(
          "8",
          "2026-10-12T18:45Z",
          ["164", "Spain"],
          ["477", "Croatia"],
          "Estadio de La Cartuja",
          true,
          "uefa.nations",
        ),
      ],
    };
    expect(partidosEnCasa(seleccion, "uefa.nations")).toEqual([
      {
        id: "partido-7",
        fecha: "2026-11-15",
        hora: "20:45",
        tipo: "partido",
        titulo: "España – Inglaterra (Nations League)",
      },
    ]);
  });

  it("una final en otro estadio no cuenta; una respuesta rota no inventa nada", () => {
    const final = {
      events: [partido("9", "2027-04-25T19:30Z", ATM, ["83", "Barcelona"], "La Cartuja")],
    };
    expect(partidosEnCasa(final, "esp.copa_del_rey")).toEqual([]);
    expect(partidosEnCasa(null, "esp.1")).toEqual([]);
    expect(partidosEnCasa({ events: "x" }, "esp.1")).toEqual([]);
  });

  it("de Ticketmaster, los conciertos del estadio: sin partidos, cancelados ni repetidos", () => {
    const tm = {
      _embedded: {
        events: [
          {
            id: "a",
            name: "Bad Bunny",
            dates: {
              start: { localDate: "2027-06-02", localTime: "21:30:00" },
              status: { code: "onsale" },
            },
            classifications: [{ segment: { name: "Music" } }],
            _embedded: { venues: [{ name: "Riyadh Air Metropolitano" }] },
          },
          {
            id: "b",
            name: "Bad Bunny - VIP Package",
            dates: { start: { localDate: "2027-06-02", localTime: "21:30:00" } },
            classifications: [{ segment: { name: "Music" } }],
            _embedded: { venues: [{ name: "Riyadh Air Metropolitano" }] },
          },
          {
            id: "c",
            name: "Atlético de Madrid vs Real Madrid",
            dates: { start: { localDate: "2027-02-14" } },
            classifications: [{ segment: { name: "Sports" } }],
            _embedded: { venues: [{ name: "Riyadh Air Metropolitano" }] },
          },
          {
            id: "d",
            name: "Otro concierto",
            dates: { start: { localDate: "2027-07-01" }, status: { code: "cancelled" } },
            _embedded: { venues: [{ name: "Riyadh Air Metropolitano" }] },
          },
          {
            id: "e",
            name: "En otro sitio",
            dates: { start: { localDate: "2027-07-02" } },
            _embedded: { venues: [{ name: "WiZink Center" }] },
          },
        ],
      },
    };
    expect(eventosDeTicketmaster(tm)).toEqual([
      {
        id: "evento-a",
        fecha: "2027-06-02",
        hora: "21:30",
        tipo: "concierto",
        titulo: "Bad Bunny",
      },
    ]);
    expect(eventosDeTicketmaster({})).toEqual([]);
  });

  it("junta, ordena y lo dice claro", () => {
    const [b, v] = partidosEnCasa(ESPN, "esp.1");
    expect(juntarEventos([v!, b!], [b!]).map((e) => e.id)).toEqual(["partido-2", "partido-3"]);
    expect(textoDelEvento(b!)).toBe(
      "⚽ Partido en el Metropolitano a las 21:00: Atlético – Real Betis (Liga)",
    );
    expect(textoDelEvento(v!)).toBe(
      "⚽ Partido en el Metropolitano (hora por confirmar): Atlético – Valencia (Liga)",
    );
  });

  it("el título corto del calendario: solo quién juega, sin estadio ni competición (D-161)", () => {
    const [b] = partidosEnCasa(ESPN, "esp.1");
    expect(tituloCortoDelEvento(b!)).toBe("⚽ Atlético – Real Betis");
    expect(
      tituloCortoDelEvento({
        id: "e",
        fecha: "2027-06-02",
        hora: null,
        tipo: "concierto",
        titulo: "Bad Bunny",
      }),
    ).toBe("🎤 Bad Bunny");
  });

  it("lo demás que se hace ese día: citas (también de varios días), fiestas y cumpleaños", () => {
    const planes = {
      agenda: [
        { fecha: "2026-12-05", hasta: "2026-12-07", titulo: "Puente en la sierra" },
        { fecha: "2026-12-06", titulo: "Comida en casa" },
        { fecha: "2026-12-09", titulo: "Otro día" },
      ],
      eventos: { "2026-12-06": { titulo: "Fiesta del barrio" } },
      cumples: [{ nombre: "Leo", dia: 6, mes: 12 }],
    };
    expect(planesDelDia("2026-12-06", planes)).toEqual([
      "Puente en la sierra",
      "Comida en casa",
      "Fiesta del barrio",
      "Cumple de Leo",
    ]);
    expect(planesDelDia("2026-12-20", planes)).toEqual([]);
  });

  it("en los listados por mes, la hora provisional está dentro del partido (D-163)", () => {
    const mes = {
      events: [
        {
          id: "10",
          date: "2026-12-13T20:00Z",
          competitions: [
            {
              timeValid: false,
              venue: { fullName: "Riyadh Air Metropolitano" },
              competitors: [
                { homeAway: "home", team: { id: "1068", displayName: "Atlético Madrid" } },
                { homeAway: "away", team: { id: "94", displayName: "Valencia" } },
              ],
            },
          ],
        },
      ],
    };
    expect(partidosEnCasa(mes, "esp.1")[0]).toMatchObject({ fecha: "2026-12-13", hora: null });
  });
});
