import { describe, expect, it } from "vitest";
import { depurarCircular, mensajeParaCircular } from "./ia-circular";

const hoy = "2026-11-04";
const it_ = (
  titulo: string,
  fecha = "",
  hasta = "",
  hora = "",
  tipo: "cita" | "tarea" = "cita",
) => ({ tipo, titulo, fecha, hasta, hora });

describe("depurar lo que devuelve la IA al leer una circular", () => {
  it("una cita con fecha válida se queda; sin fecha pasa a tarea", () => {
    const { items } = depurarCircular(
      [
        it_("Excursión al zoo", "2026-11-20", "", "09:00"),
        it_("Firmar la autorización", "", "", "", "tarea"),
        it_("Algo raro", "20/11"),
      ],
      hoy,
    );
    expect(items.map((i) => [i.tipo, i.titulo, i.fecha, i.hora])).toEqual(
      [
        ["cita", "Excursión al zoo", "2026-11-20", "09:00"],
        ["tarea", "Firmar la autorización", null, null],
        ["tarea", "Algo raro", null, null],
      ].sort(
        (a, b) =>
          String(a[2] ?? "9999").localeCompare(String(b[2] ?? "9999")) ||
          String(a[1]).localeCompare(String(b[1]), "es"),
      ),
    );
  });

  it("la hora solo vale con fecha y si es HH:MM; el «hasta» debe ser posterior", () => {
    const { items } = depurarCircular(
      [
        it_("Puente", "2026-12-04", "2026-12-08", "25:00"),
        it_("Festival", "2026-12-18", "2026-12-17", "17:30"),
      ],
      hoy,
    );
    expect(items.find((i) => i.titulo === "Puente")).toMatchObject({
      hasta: "2026-12-08",
      hora: null,
    });
    expect(items.find((i) => i.titulo === "Festival")).toMatchObject({
      hasta: null,
      hora: "17:30",
    });
  });

  it("quita lo que ya pasó y lo cuenta, salvo lo que dura hasta hoy o después", () => {
    const r = depurarCircular(
      [
        it_("Ayer", "2026-11-03"),
        it_("Vacaciones", "2026-11-01", "2026-11-06"),
        it_("Hoy", "2026-11-04"),
      ],
      hoy,
    );
    expect(r.pasados).toBe(1);
    expect(r.items.map((i) => i.titulo)).toEqual(["Vacaciones", "Hoy"]);
  });

  it("sin repetidos y con los espacios arreglados", () => {
    const r = depurarCircular(
      [it_("Reunión  de padres", "2026-11-10"), it_("reunión de padres", "2026-11-10")],
      hoy,
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.titulo).toBe("Reunión de padres");
  });

  it("el mensaje lleva la fecha de hoy y el texto aparte, como dato", () => {
    expect(mensajeParaCircular(hoy)).toContain("Hoy es 2026-11-04");
    expect(mensajeParaCircular(hoy)).toContain("va adjunta");
    expect(mensajeParaCircular(hoy, "Excursión el 17")).toContain(
      "<circular>\nExcursión el 17\n</circular>",
    );
  });
});
