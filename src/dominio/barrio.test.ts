import { describe, expect, it } from "vitest";
import { esQuinta, lineaDelPlan, planesDelBarrio, planesDelFinde } from "./barrio";

/** Recortes de la agenda real del Ayuntamiento (15-11-2026). */
const D = (barrio: string, distrito = "SanBlas-Canillejas") => ({
  district: {
    "@id": `https://datos.madrid.es/egob/kos/Provincia/Madrid/Municipio/Madrid/Distrito/${distrito}`,
  },
  area: {
    "@id": `https://datos.madrid.es/egob/kos/Provincia/Madrid/Municipio/Madrid/Distrito/${distrito}/Barrio/${barrio}`,
  },
});
const agenda = {
  "@graph": [
    {
      id: "1",
      "@type": "https://datos.madrid.es/egob/kos/actividades/CuentacuentosTiteresMarionetas",
      title: "'Otoño de cuentos' con Alicia Cuenteando",
      free: 1,
      price: "",
      dtstart: "2026-11-19 18:00:00.0",
      dtend: "2026-11-19 23:59:00.0",
      time: "18:00",
      link: "http://www.madrid.es/cuentos",
      "event-location": "Biblioteca Pública Municipal Canillejas (San Blas-Canillejas)",
      address: D("Canillejas"),
    },
    {
      id: "2",
      "@type": "https://datos.madrid.es/egob/kos/actividades/Flamenco",
      title: "VI Festival De Raíz Flamenca",
      free: 1,
      dtstart: "2026-11-20 00:00:00.0",
      dtend: "2026-11-22 23:59:00.0",
      time: "",
      "event-location": "Centro Cultural Antonio Machado (San Blas - Canillejas)",
      address: D("Arcos"),
    },
    {
      id: "3",
      title: "Visita guiada",
      free: 0,
      price: "3 euros",
      dtstart: "2026-11-28 11:00:00.0",
      dtend: "2026-11-28 23:59:00.0",
      time: "11:00",
      "event-location": "Espacio Abierto Quinta de los Molinos",
      address: D("ElSalvador"),
    },
    {
      id: "4",
      title: "Tertulia en inglés (infantil)",
      free: 1,
      dtstart: "2026-09-28 18:00:00.0",
      dtend: "2027-06-14 23:59:00.0",
      time: "18:00",
      address: D("Rosas"),
    },
    {
      id: "5",
      title: "Campamentos urbanos de Navidad",
      free: 0,
      dtstart: "2026-12-23 09:00:00.0",
      dtend: "2027-01-08 23:59:00.0",
      address: D("Rejas"),
    },
    {
      id: "6",
      title: "Teatro en el Centro",
      free: 1,
      dtstart: "2026-11-21 20:00:00.0",
      dtend: "2026-11-21 23:59:00.0",
      time: "20:00",
      address: D("Cortes", "Centro"),
    },
    {
      id: "7",
      title: "Pasado",
      dtstart: "2026-10-01 18:00:00.0",
      dtend: "2026-10-01 23:59:00.0",
      address: D("Rosas"),
    },
  ],
};
const HOY = "2026-11-16";

describe("planes del barrio (D-165)", () => {
  const p = planesDelBarrio(agenda, HOY);

  it("solo San Blas-Canillejas, de hoy en adelante, sin cursos de meses ni lo pasado", () => {
    expect(p.map((x) => x.id)).toEqual(["1", "2", "3", "5"]);
  });

  it("lugar sin el distrito, barrio legible, hora, precio y gratis", () => {
    expect(p[0]).toEqual({
      id: "1",
      fecha: "2026-11-19",
      hasta: null,
      hora: "18:00",
      titulo: "'Otoño de cuentos' con Alicia Cuenteando",
      lugar: "Biblioteca Pública Municipal Canillejas",
      barrio: "Canillejas",
      gratis: true,
      precio: null,
      enlace: expect.stringContaining("https://www.google.com/search?q="),
      familiar: true,
      serie: false,
      emoji: "🧸",
    });
    expect(p[1]).toMatchObject({
      hasta: "2026-11-22",
      hora: null,
      barrio: "Arcos",
      emoji: "💃",
      familiar: false,
    });
    expect(p[2]).toMatchObject({ gratis: false, precio: "3 euros", barrio: "El Salvador" });
  });

  it("los campamentos de 16 días entran (familiares); las tertulias de meses, no", () => {
    expect(p.find((x) => x.id === "5")).toMatchObject({ familiar: true, hasta: "2027-01-08" });
  });

  it("una respuesta rota no inventa nada", () => {
    expect(planesDelBarrio(null, HOY)).toEqual([]);
    expect(planesDelBarrio({ "@graph": "x" }, HOY)).toEqual([]);
  });

  it("una línea para el aviso, y los planes de familia del fin de semana que viene", () => {
    expect(lineaDelPlan(p[0]!)).toBe(
      "jue 19 18:00 'Otoño de cuentos' con Alicia Cuenteando (Canillejas)",
    );
    // Viernes 20: el finde es el 21 y el 22. Solo lo familiar.
    const finde = planesDelFinde(
      [
        ...p,
        { ...p[0]!, id: "9", fecha: "2026-11-21", hora: "11:00" },
        { ...p[0]!, id: "10", fecha: "2026-11-21", familiar: false },
      ],
      "2026-11-20",
    );
    expect(finde.map((x) => x.id)).toEqual(["9"]);
  });
});

describe("Quinta de los Molinos (D-170)", () => {
  const evento = (id: string, titulo: string, ini: string, fin: string, lugar: string) => ({
    id,
    title: titulo,
    free: 0,
    price: "5 euros",
    dtstart: `${ini} 11:00:00.0`,
    dtend: `${fin} 23:59:00.0`,
    time: "11:00",
    link: "http://www.madrid.es/x",
    "event-location": lugar,
    address: {
      district: {
        "@id":
          "https://datos.madrid.es/egob/kos/Provincia/Madrid/Municipio/Madrid/Distrito/SanBlas-Canillejas",
      },
    },
  });
  const json = {
    "@graph": [
      evento(
        "1",
        "Taller de cajas mágicas",
        "2026-12-20",
        "2026-12-20",
        "Espacio Abierto Quinta de los Molinos",
      ),
      evento(
        "2",
        "Taller de creación musical",
        "2027-02-06",
        "2027-04-17",
        "Espacio Abierto Quinta de los Molinos",
      ),
      evento("3", "Curso de pintura", "2026-11-10", "2027-05-10", "Centro Cultural Buero Vallejo"),
    ],
  };
  it("reconoce el lugar", () => {
    expect(esQuinta("Espacio Abierto Quinta de los Molinos")).toBe(true);
    expect(esQuinta("Parque Quinta de los Molinos")).toBe(true);
    expect(esQuinta("Biblioteca Canillejas")).toBe(false);
  });
  it("sus talleres cuentan como de familia y los ciclos de meses se guardan como serie", () => {
    const p = planesDelBarrio(json, "2026-11-16");
    expect(p.find((x) => x.id === "1")).toMatchObject({ familiar: true, serie: false });
    expect(p.find((x) => x.id === "2")).toMatchObject({ familiar: true, serie: true });
    // Un curso de meses de otro centro sigue sin ser un plan.
    expect(p.find((x) => x.id === "3")).toBeUndefined();
  });
  it("las series no salen en el aviso del fin de semana", () => {
    const p = planesDelBarrio(json, "2027-02-08");
    expect(planesDelFinde(p, "2027-02-12")).toEqual([]);
  });
});
