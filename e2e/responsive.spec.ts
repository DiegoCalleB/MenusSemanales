import AxeBuilder from "@axe-core/playwright";
import { type Browser, type Page, expect, test } from "@playwright/test";

/**
 * Responsive de verdad: cada pantalla se comprueba en móviles pequeños y grandes, en vertical y
 * en horizontal, tablets y escritorios, en tema claro y oscuro. Verifica que no desborda, que lo
 * táctil es cómodo, que la navegación cambia en el punto de corte y que cumple WCAG 2.2 AA.
 */

const PANTALLAS = [
  { nombre: "móvil muy pequeño (320)", ancho: 320, alto: 568 },
  { nombre: "móvil (375)", ancho: 375, alto: 667 },
  { nombre: "móvil grande (430)", ancho: 430, alto: 932 },
  { nombre: "móvil en horizontal (667×375)", ancho: 667, alto: 375 },
  { nombre: "justo antes del corte (767)", ancho: 767, alto: 1024 },
  { nombre: "tablet (768)", ancho: 768, alto: 1024 },
  { nombre: "tablet en horizontal (1024)", ancho: 1024, alto: 768 },
  { nombre: "portátil (1280)", ancho: 1280, alto: 800 },
  { nombre: "escritorio (1440)", ancho: 1440, alto: 900 },
  { nombre: "pantalla ancha (1920)", ancho: 1920, alto: 1080 },
] as const;

const RUTAS = ["/", "/menu", "/menu/cole", "/compra", "/despensa", "/reparto"] as const;
const PUNTO_DE_CORTE = 768; // md de Tailwind

async function abrir(
  browser: Browser,
  ancho: number,
  alto: number,
  tema: "light" | "dark" = "light",
) {
  const tactil = ancho < PUNTO_DE_CORTE;
  const contexto = await browser.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: tactil,
    hasTouch: tactil,
    colorScheme: tema,
  });
  return { contexto, pagina: await contexto.newPage() };
}

async function cargar(pagina: Page, ruta: string) {
  await pagina.goto(ruta, { waitUntil: "networkidle" });
  await expect(pagina.getByRole("heading", { level: 1 })).toBeVisible();
}

for (const pantalla of PANTALLAS) {
  test.describe(pantalla.nombre, () => {
    const movil = pantalla.ancho < PUNTO_DE_CORTE;

    for (const ruta of RUTAS) {
      test(`${ruta}: no desborda y la navegación es la adecuada`, async ({ browser }) => {
        const { contexto, pagina } = await abrir(browser, pantalla.ancho, pantalla.alto);
        await cargar(pagina, ruta);

        // 1. Nada se sale de la pantalla (ni siquiera a 320 px).
        const sobra = await pagina.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(sobra, "desbordamiento horizontal").toBeLessThanOrEqual(1);

        // 2. La navegación cambia exactamente en el punto de corte.
        const inferior = pagina.locator("nav.fixed");
        const lateral = pagina.locator("aside");
        if (movil) {
          await expect(inferior).toBeVisible();
          await expect(lateral).toBeHidden();
        } else {
          await expect(lateral).toBeVisible();
          await expect(inferior).toBeHidden();
        }

        // 3. Estructura básica: un solo main y un solo h1.
        await expect(pagina.locator("main")).toHaveCount(1);
        await expect(pagina.getByRole("heading", { level: 1 })).toHaveCount(1);

        // 4. Texto legible: nunca menos de 16 px en el cuerpo.
        const tamano = await pagina.evaluate(() =>
          parseFloat(getComputedStyle(document.body).fontSize),
        );
        expect(tamano).toBeGreaterThanOrEqual(16);

        await contexto.close();
      });

      if (movil) {
        test(`${ruta}: lo táctil mide al menos 44×44 px y la barra inferior no tapa contenido`, async ({
          browser,
        }) => {
          const { contexto, pagina } = await abrir(browser, pantalla.ancho, pantalla.alto);
          await cargar(pagina, ruta);

          const pequenos = await pagina.evaluate(() => {
            const selector =
              'a[href], button, select, summary, textarea, input:not([type="hidden"]), [role="tab"]';
            const fuera: string[] = [];
            for (const el of document.querySelectorAll<HTMLElement>(selector)) {
              const estilo = getComputedStyle(el);
              if (estilo.display === "none" || estilo.visibility === "hidden") continue;
              // Una casilla se toca por su fila (la etiqueta que la envuelve), no por el cuadradito.
              const objetivo =
                el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")
                  ? (el.closest("label") ?? el)
                  : el;
              const r = objetivo.getBoundingClientRect();
              if (r.width <= 1 && r.height <= 1) continue; // enlace «saltar al contenido» (solo visible al enfocarlo)
              if (r.width < 43.5 || r.height < 43.5) {
                const texto = (el.getAttribute("aria-label") ?? el.textContent ?? "")
                  .trim()
                  .slice(0, 30);
                fuera.push(
                  `<${el.tagName.toLowerCase()}> «${texto}» ${Math.round(r.width)}×${Math.round(r.height)}`,
                );
              }
            }
            return fuera;
          });
          expect(pequenos, "elementos táctiles menores de 44×44 px").toEqual([]);

          // Al final de la página, lo último queda por encima de la barra inferior.
          const hueco = await pagina.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
            const barra = document.querySelector("nav.fixed")?.getBoundingClientRect().top ?? 0;
            const ultimo =
              document.querySelector("main")?.lastElementChild?.getBoundingClientRect().bottom ?? 0;
            return barra - ultimo;
          });
          expect(
            hueco,
            "espacio entre el final del contenido y la barra inferior",
          ).toBeGreaterThanOrEqual(0);

          await contexto.close();
        });
      }
    }
  });
}

// Accesibilidad (WCAG 2.2 AA) en los tamaños representativos, en claro y en oscuro.
for (const tema of ["light", "dark"] as const) {
  for (const { nombre, ancho, alto } of [PANTALLAS[0], PANTALLAS[2], PANTALLAS[6], PANTALLAS[8]]) {
    for (const ruta of RUTAS) {
      test(`accesibilidad ${ruta} · ${nombre} · tema ${tema === "light" ? "claro" : "oscuro"}`, async ({
        browser,
      }) => {
        const { contexto, pagina } = await abrir(browser, ancho, alto, tema);
        await cargar(pagina, ruta);
        const resultado = await new AxeBuilder({ page: pagina })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        const resumen = resultado.violations.map(
          (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
        );
        expect(resumen).toEqual([]);
        await contexto.close();
      });
    }
  }
}

// Flujos completos en un móvil real: lo que hace la familia en el súper y en la cocina.
test.describe("flujos en móvil", () => {
  test("comprar, ver que llega a la despensa al cambiar de pantalla y deshacer", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/compra");

    const progreso = pagina.getByText(/^\d+ de \d+$/).first();
    const antes = await progreso.textContent();
    await pagina.getByRole("checkbox", { name: /Calabacín/ }).check();
    await expect(pagina.getByRole("status")).toContainText("Comprado: Calabacín");
    await expect(progreso).not.toHaveText(antes ?? "");

    // El estado se conserva al navegar: el calabacín está ahora en la nevera.
    await pagina.getByRole("link", { name: "Despensa" }).click();
    await expect(pagina.getByRole("heading", { level: 1, name: /Despensa/ })).toBeVisible();
    await expect(pagina.getByRole("heading", { name: "Calabacín", level: 3 })).toBeVisible();

    // Vuelve a la compra y deshace desmarcando.
    await pagina.getByRole("link", { name: "Compra" }).click();
    await pagina.getByRole("checkbox", { name: /Calabacín/ }).uncheck();
    await expect(pagina.getByRole("status")).toContainText("Deshecho");
    await expect(pagina.getByRole("checkbox", { name: /Calabacín/ })).not.toBeChecked();
    await contexto.close();
  });

  test("menú: elegir una cena actualiza la lista de la compra", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await pagina
      .getByRole("button", { name: /^Elegir / })
      .first()
      .click();
    await expect(pagina.getByRole("status")).toContainText("La compra se ha actualizado");
    await pagina.getByRole("link", { name: "Compra" }).click();
    await expect(pagina.getByRole("heading", { level: 1, name: /compra/i })).toBeVisible();
    await contexto.close();
  });

  test("modo prueba: lo hecho sobrevive a recargar y «Restablecer ejemplo» lo borra", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/compra");
    await pagina.getByLabel("Añadir algo a la lista").fill("Velas");
    await pagina.getByRole("button", { name: "Añadir" }).click();
    await expect(pagina.getByRole("checkbox", { name: /Velas/ })).toBeVisible();

    await pagina.reload({ waitUntil: "networkidle" });
    await expect(pagina.getByRole("checkbox", { name: /Velas/ })).toBeVisible();

    await pagina.getByRole("button", { name: "Restablecer ejemplo" }).click();
    await expect(pagina.getByRole("checkbox", { name: /Velas/ })).toHaveCount(0);
    await pagina.reload({ waitUntil: "networkidle" });
    await expect(pagina.getByRole("checkbox", { name: /Velas/ })).toHaveCount(0);
    await contexto.close();
  });

  test("menú: 15 días y menú del cole leído desde texto", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await pagina.getByRole("button", { name: "Próximos 15 días" }).click();
    await expect(pagina.getByRole("heading", { level: 2, name: /18 de noviembre/i })).toBeVisible();

    await pagina.getByRole("link", { name: "Menú del cole" }).click();
    await expect(pagina.getByRole("heading", { level: 1, name: "Menú del cole" })).toBeVisible();
    await pagina.getByRole("button", { name: "Usar el ejemplo de noviembre" }).click();
    await pagina.getByRole("button", { name: "Leer menú" }).click();
    await expect(
      pagina.getByRole("heading", { level: 2, name: /Revisa lo leído \(19 días\)/ }),
    ).toBeVisible();
    await pagina.getByRole("button", { name: "Guardar menú del cole" }).click();
    await expect(pagina.getByRole("status")).toContainText("Menú del cole guardado: 19 días");
    await contexto.close();
  });

  test("añadir un artículo a mano y marcarlo", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/compra");
    await pagina.getByLabel("Añadir algo a la lista").fill("Yogures");
    await pagina.getByRole("button", { name: "Añadir" }).click();
    await expect(pagina.getByRole("checkbox", { name: /Yogures/ })).toBeVisible();
    await pagina.getByRole("checkbox", { name: /Yogures/ }).check();
    await expect(pagina.getByRole("checkbox", { name: /Yogures/ })).toBeChecked();
    await contexto.close();
  });

  test("despensa: pestañas con teclado, cocinar y deshacer", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/despensa");

    const nevera = pagina.getByRole("tab", { name: /Nevera/ });
    await nevera.focus();
    await pagina.keyboard.press("ArrowRight");
    await expect(pagina.getByRole("tab", { name: /^Despensa/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await pagina.getByLabel("Plato").selectOption({ label: "Merluza al horno con patata" });
    await expect(pagina.getByText("−450 g").first()).toBeVisible();
    await pagina.getByRole("button", { name: "Cocinar y descontar" }).click();
    await expect(pagina.getByRole("status")).toContainText("Cocinado: Merluza al horno con patata");
    await pagina.getByRole("button", { name: "Deshacer" }).click();
    await expect(pagina.getByRole("status")).toContainText("Deshecho");
    await contexto.close();
  });

  test("despensa: lo caducado se puede tirar y se recupera con deshacer", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/despensa");
    await expect(pagina.getByText("Caducado").first()).toBeVisible();
    await pagina.getByRole("button", { name: "Tirar lo caducado" }).click();
    await expect(pagina.getByRole("status")).toContainText("Tirado lo caducado");
    await pagina.getByRole("button", { name: "Deshacer" }).click();
    await expect(pagina.getByText("Caducado").first()).toBeVisible();
    await contexto.close();
  });

  test("reparto: gráfico, tabla alternativa, asignar y proponer un reparto más parejo", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/reparto");

    await expect(pagina.getByRole("img", { name: /Ana: .* minutos ejecutando/ })).toBeVisible();
    await pagina.getByText("Ver como tabla").click();
    await expect(pagina.getByRole("table")).toBeVisible();

    const estado = pagina.getByRole("status").filter({ hasText: "Esta semana" });
    await expect(estado).toContainText(/puntos de diferencia/);
    await pagina.getByRole("button", { name: "Proponer un reparto más parejo" }).click();
    await expect(estado).toContainText(/parejo|puntos de diferencia/);

    await expect(pagina.getByText("Sin responsable").first()).toBeVisible();
    await pagina.getByLabel("Responsable").last().selectOption({ label: "Diego" });
    await contexto.close();
  });
});
