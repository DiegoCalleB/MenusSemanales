import { describe, expect, it } from "vitest";
import { type MenuColeLeido } from "./menu-cole";
import { comprobarMenuLeido, entradasDeMenu, entradasDelBlog } from "./menu-cole-blog";

const entrada = (titulo: string, fecha: string, html: string, url = "menu") => ({
  title: { $t: titulo },
  published: { $t: `${fecha}T10:00:00.000+01:00` },
  link: [
    { rel: "replies", href: "https://x/c" },
    { rel: "alternate", href: `https://ceip.blogspot.com/2026/10/${url}.html` },
  ],
  content: { $t: html },
});
const carpeta = (t: string) => `<a href="https://cloud.educa.madrid.org/s/${t}"><img src="x"></a>`;

describe("blog del cole (D-173)", () => {
  const feed = {
    feed: {
      entry: [
        entrada("MENÚ OCTUBRE", "2026-09-30", carpeta("XAKFsSy7RH3bDT6"), "menu-octubre"),
        entrada("MENÚ NOVIEMBRE", "2026-10-28", carpeta("GYrywYsRwzAGKLG"), "menu-noviembre"),
        entrada(
          "PRECIOS DE COMEDOR: CURSO 2026-2027",
          "2026-09-10",
          carpeta("AAAAAAAAAAAA"),
          "precios",
        ),
        entrada("MENÚ DE COMEDOR", "2026-06-01", "<p>sin enlace</p>", "menu-junio"),
      ],
    },
  };

  it("lee las entradas, la carpeta de la nube y las ordena de más nueva a más vieja", () => {
    const e = entradasDelBlog(feed);
    expect(e.map((x) => x.titulo)).toEqual([
      "MENÚ NOVIEMBRE",
      "MENÚ OCTUBRE",
      "PRECIOS DE COMEDOR: CURSO 2026-2027",
      "MENÚ DE COMEDOR",
    ]);
    expect(e[0]?.carpeta).toBe("GYrywYsRwzAGKLG");
    expect(e[3]?.carpeta).toBeNull();
    expect(entradasDelBlog({ feed: {} })).toEqual([]);
    expect(entradasDelBlog(null)).toEqual([]);
  });

  it("solo valen las que son un menú, con carpeta y recientes (no los precios)", () => {
    const m = entradasDeMenu(entradasDelBlog(feed), "2026-11-16");
    expect(m.map((x) => x.titulo)).toEqual(["MENÚ NOVIEMBRE", "MENÚ OCTUBRE"]);
  });

  const dia = (fecha: string, ok = true) => ({
    fecha,
    primero: "Lentejas",
    segundo: ok ? "Tortilla" : null,
    guarnicion: null,
    postre: "Fruta",
    kcal: 600,
    grupoPrimero: null,
    grupoSegundo: null,
  });
  const laborables = (mes: string, n: number) =>
    Array.from({ length: 31 }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)
      .filter(
        (f) =>
          !Number.isNaN(Date.parse(f)) &&
          new Date(`${f}T12:00:00Z`).getUTCMonth() === Number(mes.slice(5)) - 1,
      )
      .filter((f) => ![0, 6].includes(new Date(`${f}T12:00:00Z`).getUTCDay()))
      .slice(0, n);
  const menu = (mes: string, n: number, ok = true): MenuColeLeido => ({
    anio: Number(mes.slice(0, 4)),
    mes: Number(mes.slice(5)),
    dias: laborables(mes, n).map((f) => dia(f, ok)),
    avisos: [],
  });

  it("acepta un mes entero y cercano", () => {
    expect(comprobarMenuLeido(menu("2026-12", 17), "2026-11-28")).toEqual({
      ok: true,
      motivo: "ok",
    });
  });
  it("rechaza lo raro: pocos días, mes lejano, fin de semana, otro mes, platos incompletos", () => {
    expect(comprobarMenuLeido(menu("2026-12", 5), "2026-11-28").ok).toBe(false);
    expect(comprobarMenuLeido(menu("2028-03", 15), "2026-11-28").motivo).toBe("mes-lejano");
    const finde = menu("2026-12", 15);
    finde.dias[0] = dia("2026-12-05");
    expect(comprobarMenuLeido(finde, "2026-11-28").motivo).toBe("fin-de-semana");
    const otro = menu("2026-12", 15);
    otro.dias[0] = dia("2027-01-04");
    expect(comprobarMenuLeido(otro, "2026-11-28").motivo).toBe("dia-de-otro-mes");
    expect(comprobarMenuLeido(menu("2026-12", 15, false), "2026-11-28").motivo).toBe(
      "platos-incompletos",
    );
  });
});
