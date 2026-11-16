import { describe, expect, it, vi } from "vitest";
import type { EntradaBlog } from "@/dominio/menu-cole-blog";
import { type Dependencias, sincronizarMenuCole } from "./sincronizar-menu-cole";

const TEXTO = (mes: string, dias: string[]) =>
  `Menú Basal ${mes}\n${dias
    .map(
      (d) =>
        `${d}\nGuiso de lentejas con zanahoria\nTortilla de patata\nEnsalada\nFruta fresca y pan\nKcal: 600,1 prot (g): 20`,
    )
    .join("\n")}`;
// Diciembre de 2026: lunes a viernes del 1 al 23 (17 días).
const DIAS_DIC = Array.from({ length: 23 }, (_, i) => i + 1)
  .filter(
    (d) =>
      ![0, 6].includes(new Date(`2026-12-${String(d).padStart(2, "0")}T12:00:00Z`).getUTCDay()),
  )
  .map((d) => String(d).padStart(2, "0"));

const entrada = (titulo: string, publicada: string, carpeta: string | null): EntradaBlog => ({
  enlace: `https://ceip.blogspot.com/${titulo}`,
  titulo,
  publicada,
  carpeta,
});

function deps(extra: Partial<Dependencias> = {}) {
  const registrado: Array<{ post: string; resultado: string; dias?: unknown }> = [];
  const avisos: string[] = [];
  const d: Dependencias = {
    hoy: "2026-11-28",
    ahora: () => Date.parse("2026-11-28T08:00:00Z"),
    centros: async () => [
      {
        centro: "c1",
        fuente: "https://ceip.blogspot.com/feeds/posts/default/-/COMEDOR",
        tokens: ["t1"],
      },
    ],
    entradas: async () => [
      entrada("MENÚ DICIEMBRE", "2026-11-27", "CARPETA1234"),
      entrada("MENÚ NOVIEMBRE", "2026-10-28", "CARPETA9999"),
    ],
    vistas: async () => [],
    pdf: async () => "UERG",
    transcribir: async () => TEXTO("Diciembre 2026", DIAS_DIC),
    registrar: async (_c, post, resultado, dias) => {
      registrado.push({ post, resultado, dias });
      return dias ? `cargado:${(dias as unknown[]).length}` : resultado;
    },
    avisar: async (_t, titulo) => {
      avisos.push(titulo);
    },
    ...extra,
  };
  return { d, registrado, avisos };
}

describe("sincronizar el menú del cole (D-173)", () => {
  it("carga el mes nuevo, avisa y no toca las entradas viejas", async () => {
    const { d, registrado, avisos } = deps();
    const r = await sincronizarMenuCole(d);
    expect(r).toHaveLength(1);
    expect(r[0]?.resultado).toMatch(/^cargado:\d+$/);
    expect(registrado).toHaveLength(1);
    expect(registrado[0]?.post).toContain("DICIEMBRE");
    expect(avisos).toEqual(["🍽️ Ya está el menú de diciembre"]);
  });

  it("si ya se cargó, no vuelve a hacer nada", async () => {
    const pdf = vi.fn();
    const { d } = deps({
      vistas: async () => [
        {
          post: "https://ceip.blogspot.com/MENÚ DICIEMBRE",
          resultado: "cargado:17",
          intentos: 1,
          vistoEn: "2026-11-27T08:00:00Z",
        },
      ],
      pdf,
    });
    expect(await sincronizarMenuCole(d)).toEqual([]);
    expect(pdf).not.toHaveBeenCalled();
  });

  it("si lo leído no tiene sentido, no carga nada y lo anota", async () => {
    const { d, registrado, avisos } = deps({ transcribir: async () => "basura" });
    const r = await sincronizarMenuCole(d);
    expect(r[0]?.resultado).toMatch(/^no-valido/);
    expect(registrado[0]?.dias).toBeUndefined();
    expect(avisos).toEqual([]);
  });

  it("un fallo se reintenta al día siguiente (no el mismo día) y hasta tres veces", async () => {
    const visto = (intentos: number, vistoEn: string) => [
      { post: "https://ceip.blogspot.com/MENÚ DICIEMBRE", resultado: "sin-pdf", intentos, vistoEn },
    ];
    const hoy = deps({ vistas: async () => visto(1, "2026-11-28T06:00:00Z") });
    expect(await sincronizarMenuCole(hoy.d)).toEqual([]);
    const ayer = deps({ vistas: async () => visto(1, "2026-11-27T06:00:00Z") });
    expect(await sincronizarMenuCole(ayer.d)).toHaveLength(1);
    const tres = deps({ vistas: async () => visto(3, "2026-11-20T06:00:00Z") });
    expect(await sincronizarMenuCole(tres.d)).toEqual([]);
  });

  it("si no se puede bajar el PDF o la IA falla, lo anota sin romper", async () => {
    const a = deps({ pdf: async () => null });
    expect((await sincronizarMenuCole(a.d))[0]?.resultado).toBe("sin-pdf");
    const b = deps({
      transcribir: async () => {
        throw new Error("ia-http-503");
      },
    });
    expect((await sincronizarMenuCole(b.d))[0]?.resultado).toBe("error: ia-http-503");
  });

  it("ignora las entradas viejas y las que no son un menú", async () => {
    const { d } = deps({
      entradas: async () => [
        entrada("MENÚ OCTUBRE", "2026-09-30", "CARPETA1111"),
        entrada("PRECIOS DE COMEDOR", "2026-11-26", "CARPETA2222"),
      ],
    });
    expect(await sincronizarMenuCole(d)).toEqual([]);
  });
});
