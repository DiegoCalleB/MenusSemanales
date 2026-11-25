import { describe, expect, it } from "vitest";

import { conRepetidas } from "./calendario-suscrito";
describe("fechas que se repiten en lo que lee el servidor (D-211)", () => {
  it("se convierten en citas de los próximos días, con su recordatorio del día antes", async () => {
    const base = {
      agenda: [{ fecha: "2026-11-30", hasta: null, hora: null, titulo: "Dentista" }],
      repetidas: [
        {
          titulo: "Viene Yolanda",
          hora: null,
          desde: "2026-11-25",
          cadaDias: 14,
          avisoAntes: "Dejar dinero para Yolanda",
        },
      ],
    } as unknown as Parameters<typeof conRepetidas>[0];
    const r = conRepetidas(base, "2026-11-25");
    const lista = r.agenda.map((a) => [a.fecha, a.titulo]);
    expect(lista).toEqual(
      expect.arrayContaining([
        ["2026-11-30", "Dentista"],
        ["2026-11-24", "Dejar dinero para Yolanda"],
        ["2026-11-25", "Viene Yolanda"],
        ["2026-12-08", "Dejar dinero para Yolanda"],
        ["2026-12-09", "Viene Yolanda"],
      ]),
    );
    // Sin series, no cambia nada.
    const sin = { agenda: [] } as unknown as Parameters<typeof conRepetidas>[0];
    expect(conRepetidas(sin, "2026-11-25")).toBe(sin);
  });
});
