import { readFileSync } from "node:fs";
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

const RUTAS = [
  "/",
  "/menu",
  "/menu/cole",
  "/calendario",
  "/menu/emergencia",
  "/menu/platos",
  "/compartir",
  "/tareas",
  "/cuenta",
  "/personas",
  "/cumples",
  "/fechas",
  "/casa",
  "/compra",
  "/despensa",
  "/reparto",
] as const;
const PUNTO_DE_CORTE = 768; // md de Tailwind

async function abrir(
  browser: Browser,
  ancho: number,
  alto: number,
  tema: "light" | "dark" = "light",
  perfil: string | null = "diego",
) {
  const tactil = ancho < PUNTO_DE_CORTE;
  const contexto = await browser.newContext({
    viewport: { width: ancho, height: alto },
    isMobile: tactil,
    hasTouch: tactil,
    colorScheme: tema,
  });
  const pagina = await contexto.newPage();
  // Salvo que la prueba quiera ver la pantalla de perfiles, se entra ya con un perfil elegido.
  if (perfil) {
    await pagina.addInitScript((id) => {
      // Solo la primera vez: así un cambio de perfil durante la prueba se mantiene al recargar.
      if (!window.localStorage.getItem("menus-semanales:yo")) {
        window.localStorage.setItem("menus-semanales:yo", id);
      }
    }, perfil);
  }
  // El tema es claro siempre; el oscuro solo si la persona lo elige (se guarda en el dispositivo).
  if (tema === "dark") {
    await pagina.addInitScript(() => window.localStorage.setItem("menus-semanales:tema", "oscuro"));
  }
  return { contexto, pagina };
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
    await pagina.getByRole("button", { name: "15 días" }).click();
    await expect(pagina.getByRole("heading", { level: 2, name: /18 de noviembre/i })).toBeVisible();

    await pagina.getByRole("link", { name: "Cole", exact: true }).click();
    await expect(pagina.getByRole("heading", { level: 1, name: "Menú del cole" })).toBeVisible();
    // El botón de subir el PDF se ve siempre; sin cuenta explica por qué no puede leerlo.
    await expect(pagina.getByText("📄 Subir PDF o foto del menú")).toBeVisible();
    await pagina
      .locator('input[type="file"]')
      .setInputFiles({ name: "menu.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") });
    await expect(pagina.getByRole("status").filter({ hasText: "nube" })).toBeVisible();
    await pagina.getByRole("button", { name: "Usar el ejemplo de noviembre" }).click();
    await pagina.getByRole("button", { name: "Leer menú" }).click();
    await expect(
      pagina.getByRole("heading", { level: 2, name: /Revisa lo leído \(19 días\)/ }),
    ).toBeVisible();
    await pagina.getByRole("button", { name: "Guardar menú del cole" }).click();
    await expect(
      pagina.getByRole("status").filter({ hasText: "Menú del cole guardado" }),
    ).toContainText("Menú del cole guardado: 19 días");
    await contexto.close();
  });

  test("hoy: apuntar quién ha hecho cada cosa (Lo de hoy)", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/");
    const tarjeta = pagina.getByRole("region", { name: "Lo de hoy" });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.getByText("Toca a quien lo ha hecho")).toBeVisible();

    // Un toque apunta; el mismo toque lo quita.
    const diegoCena = tarjeta.getByRole("button", { name: "Cena: Diego" });
    await diegoCena.click();
    await expect(diegoCena).toHaveAttribute("aria-pressed", "true");
    await tarjeta.getByRole("button", { name: "Compra: Diego" }).click();
    await expect(tarjeta.getByText("2 cosas hechas")).toBeVisible();
    await diegoCena.click();
    await expect(diegoCena).toHaveAttribute("aria-pressed", "false");

    // Una cosa nueva (lavavajillas) se añade una vez y se apunta a Ana.
    await tarjeta.getByRole("button", { name: /Otra cosa/ }).click();
    await tarjeta.getByLabel("Otra cosa que se ha hecho hoy").fill("Lavavajillas");
    await tarjeta.getByRole("button", { name: "Añadir", exact: true }).click();
    await tarjeta.getByRole("button", { name: "Lavavajillas: Ana" }).click();
    await expect(tarjeta.getByRole("button", { name: "Lavavajillas: Ana" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(tarjeta.getByText("2 cosas hechas")).toBeVisible();

    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await contexto.close();
  });

  test("calendario: elegir un día y apuntar una cita; en Hoy, apuntar con el día elegido", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/calendario");
    await pagina
      .getByRole("button", { name: /16 de noviembre/ })
      .first()
      .click();
    const citas = pagina.getByRole("region", { name: "Citas y eventos" });
    await expect(citas.getByText("Nada apuntado este día.")).toBeVisible();
    await citas.getByRole("button", { name: /Cita o evento este día/ }).click();
    await citas.getByLabel("Qué hay que apuntar").fill("Dentista de Alba");
    await citas.getByLabel("Hora (opcional)").fill("17:30");
    await citas.getByRole("button", { name: "＋ Apuntar" }).click();
    await expect(citas.getByText("Dentista de Alba")).toBeVisible();
    await expect(citas.getByText("17:30")).toBeVisible();
    await citas.getByRole("button", { name: "Quitar la cita Dentista de Alba" }).click();
    await expect(citas.getByText("Nada apuntado este día.")).toBeVisible();

    await cargar(pagina, "/");
    const rapida = pagina.getByRole("region", { name: "Citas y eventos" });
    await rapida.getByRole("button", { name: "＋ Cita" }).click();
    await rapida.getByLabel("Qué hay que apuntar").fill("Reunión del cole");
    await rapida.getByLabel("Día", { exact: true }).fill("2026-11-18");
    await rapida.getByRole("button", { name: "＋ Apuntar" }).click();
    await pagina.goto("/fechas", { waitUntil: "networkidle" });
    await expect(pagina.getByText("Reunión del cole").first()).toBeVisible();
    await contexto.close();
  });

  test("menú: valorar la cena de hoy por persona", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await pagina.getByRole("button", { name: /Miércoles 4 de noviembre/ }).click();
    await pagina.getByText(/¿Qué tal estuvo\?/).click();
    await pagina.getByRole("button", { name: "Ana: 5 estrellas" }).click();
    await expect(pagina.getByRole("button", { name: "Ana: 5 estrellas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: /Miércoles 4 de noviembre/ }).click();
    await pagina.getByText(/¿Qué tal estuvo\?/).click();
    await expect(pagina.getByRole("button", { name: "Ana: 5 estrellas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await contexto.close();
  });

  test("cena de emergencia: cocinar ahora descuenta y se puede deshacer", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu/emergencia");
    await expect(pagina.getByText("✓ Tenéis todo").first()).toBeVisible();
    await pagina.getByRole("button", { name: "Cocinar ahora" }).first().click();
    await expect(pagina.getByRole("status")).toContainText("Cocinado");
    await pagina.getByRole("button", { name: /Deshacer/ }).click();
    await expect(pagina.getByRole("status")).toContainText("Deshecho");
    await contexto.close();
  });

  test("platos: se pueden ver como tarjetas o como lista y se recuerda", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu/platos");
    await expect(pagina.getByRole("button", { name: "Tarjetas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await pagina.getByRole("button", { name: "Lista", exact: true }).click();
    const fila = pagina.getByRole("button", { name: /^Abrir / }).first();
    await expect(fila).toBeVisible();
    await expect(pagina.getByRole("button", { name: /^Editar / })).toHaveCount(0);
    await fila.click();
    await expect(pagina.getByRole("button", { name: /^Editar / })).toHaveCount(1);
    await pagina.reload();
    await expect(pagina.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await contexto.close();
  });

  test("catálogo: crear un plato con un ingrediente nuevo y encontrarlo", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu/platos");
    await pagina.getByRole("button", { name: "Nuevo plato" }).click();
    await pagina.getByLabel("Nombre", { exact: true }).fill("Tostada de aguacate");
    await pagina.getByRole("button", { name: /Crear ingrediente/ }).click();
    await pagina.getByLabel("Nombre del ingrediente").fill("Aguacate");
    await pagina.getByRole("button", { name: "Guardar ingrediente" }).click();
    await pagina.getByLabel("Ingrediente 1").selectOption({ label: "Aguacate" });
    await pagina.getByLabel("Cantidad", { exact: false }).first().fill("100");
    await pagina.getByRole("button", { name: "Guardar plato" }).click();
    await expect(
      pagina.getByRole("heading", { level: 2, name: /Tostada de aguacate/ }),
    ).toBeVisible();

    // Un plato sin ingredientes no se guarda y explica por qué.
    await pagina.getByRole("button", { name: "Nuevo plato" }).click();
    await pagina.getByLabel("Nombre", { exact: true }).fill("Vacío");
    await pagina.getByRole("button", { name: "Guardar plato" }).click();
    await expect(
      pagina.getByRole("alert").filter({ hasText: "Añade al menos un ingrediente" }),
    ).toBeVisible();
    await contexto.close();
  });

  test("calendario: ver el mes, elegir una cena semanas por delante y cambiar de mes", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/calendario");
    await expect(pagina.getByRole("heading", { level: 2, name: "Noviembre 2026" })).toBeVisible();
    await pagina.getByRole("button", { name: /Jueves 19 de noviembre/ }).click();
    await expect(pagina.getByText(/Sopa|Para cenar conviene/).first()).toBeVisible();
    await pagina
      .getByRole("button", { name: /^Elegir / })
      .first()
      .click();
    await expect(pagina.getByRole("status")).toContainText("Elegido para el jueves");
    await expect(pagina.getByRole("button", { name: /^Jueves 19 de noviembre/ })).not.toContainText(
      "Sin cena elegida",
    );
    await pagina.getByRole("button", { name: "Mes siguiente" }).click();
    await expect(pagina.getByRole("heading", { level: 2, name: "Diciembre 2026" })).toBeVisible();
    await contexto.close();
  });

  test("menú: cada opción explica por qué se recomienda (cole y equilibrio de la semana)", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await pagina.getByRole("button", { name: /Miércoles 4 de noviembre/ }).click();
    await pagina.getByText("Por qué").first().click();
    await expect(
      pagina.getByText(/han comido verdura y carne en el cole; para compensar/).first(),
    ).toBeVisible();
    await expect(pagina.getByText(/de trabajo, dentro de los 30 min/).first()).toBeVisible();
    await contexto.close();
  });

  test("cole: se ve de un vistazo lo que comieron y se contrasta con la cena", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/");
    // La portada enseña el menú del cole de hoy.
    await expect(pagina.getByRole("heading", { level: 2, name: "Hoy en el cole" })).toBeVisible();
    await expect(pagina.getByText("Crema suave de calabacín, zanahoria y calabaza")).toBeVisible();
    await expect(pagina.getByText("Para cenar conviene:").first()).toBeVisible();
    // En el menú, cada día enseña su cena y, al abrirlo, lo que comieron en el cole.
    await pagina.goto("/menu", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: /Miércoles 4 de noviembre/ }).click();
    await expect(pagina.getByText("Cinta de lomo a la plancha")).toBeVisible();
    await expect(pagina.getByRole("button", { name: /Miércoles 4 de noviembre/ })).toContainText(
      "Arroz con pollo al curry",
    );
    await contexto.close();
  });

  test("menú: al elegir las demás opciones siguen a la vista para marcar varios platos", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await expect(pagina.getByRole("button", { name: /^Elegir / })).toHaveCount(3);
    await pagina
      .getByRole("button", { name: /^Elegir / })
      .first()
      .click();
    const anadir = pagina.getByRole("button", { name: /^Añadir / });
    await expect(pagina.getByRole("button", { name: /^Quitar / })).toHaveCount(1);
    await anadir.first().click(); // sin volver a abrir nada: la lista sigue ahí
    await expect(pagina.getByRole("button", { name: /^Quitar / })).toHaveCount(2);
    await expect(anadir.first()).toBeVisible();
    await pagina.getByRole("button", { name: "Listo" }).click();
    await expect(anadir).toHaveCount(0);
    await contexto.close();
  });

  test("menú: una cena con varios platos pequeños", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await pagina
      .getByRole("button", { name: /^Elegir / })
      .first()
      .click();
    await pagina
      .getByRole("button", { name: /^Añadir / })
      .first()
      .click();
    await expect(pagina.getByRole("button", { name: /^Quitar / })).toHaveCount(2);
    await pagina
      .getByRole("button", { name: /^Quitar / })
      .first()
      .click();
    await expect(pagina.getByRole("button", { name: /^Quitar / })).toHaveCount(1);
    await contexto.close();
  });

  test("agenda: se apunta como en una nota, sale en la cuenta atrás y se puede quitar", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/fechas");
    await pagina.getByLabel(/Escribe como en una nota/).fill("5 Noviembre 18:15 Psicotécnico");
    await pagina.getByRole("button", { name: "Apuntar", exact: true }).click();
    const apuntes = pagina.getByRole("list", { name: "Apuntes" });
    await expect(apuntes.getByText(/Psicotécnico · 18:15/)).toBeVisible();
    // Varias líneas pegadas: antes de guardar pide confirmar.
    await pagina
      .getByLabel(/Escribe como en una nota/)
      .fill("6 Noviembre Uno\n7 Noviembre Dos\n8 Noviembre Tres\nRecoger paquete");
    await pagina.getByRole("button", { name: "Apuntar", exact: true }).click();
    await expect(pagina.getByText(/Vas a apuntar 3 con fecha y 1 sin fecha/)).toBeVisible();
    await pagina.getByRole("button", { name: "Revisar" }).click();
    await pagina.getByLabel(/Escribe como en una nota/).fill("");
    await pagina.goto("/", { waitUntil: "networkidle" });
    await expect(
      pagina
        .getByRole("list", { name: "Cuenta atrás" })
        .getByRole("listitem")
        .filter({ hasText: /Psicotécnico \(18:15\)/ }),
    ).toHaveCount(1);
    await pagina.goto("/fechas", { waitUntil: "networkidle" });
    // Para llevarlo al calendario y a Keep.
    const enlace = pagina.getByRole("link", { name: /Añadir Psicotécnico a Google Calendar/ });
    const href = (await enlace.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
    expect(href).toContain("text=Psicot%C3%A9cnico");
    expect(href).toMatch(/dates=2026\d{4}T181500%2F|dates=2026\d{4}T181500\//);
    await pagina.getByRole("button", { name: "Quitar Psicotécnico" }).first().click();
    await expect(apuntes).toHaveCount(0);
    await contexto.close();
  });

  test("si lo guardado en el móvil está roto, la app lo cuenta y deja borrarlo", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/fechas");
    await pagina.getByLabel(/Escribe como en una nota/).fill("5 Noviembre Prueba");
    await pagina.getByRole("button", { name: "Apuntar", exact: true }).click();
    await expect(pagina.getByRole("list", { name: "Apuntes" })).toBeVisible();
    // Un estado con la forma justa para pasar la comprobación pero que rompe al dibujar.
    await pagina.evaluate(() => {
      const k = "menus-semanales:prueba";
      const g = JSON.parse(window.localStorage.getItem(k) ?? "{}");
      g.estado.personas = [null];
      window.localStorage.setItem(k, JSON.stringify(g));
    });
    await pagina.goto("/fechas", { waitUntil: "networkidle" });
    await expect(pagina.getByRole("heading", { level: 1, name: /Algo ha fallado/ })).toBeVisible();
    await expect(pagina.getByRole("button", { name: "Volver a intentarlo" })).toBeVisible();
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await pagina.getByRole("button", { name: "Borrar lo guardado en este móvil" }).click();
    await pagina.getByRole("button", { name: "Sí, borrar y recargar" }).click();
    await expect(pagina.getByRole("heading", { level: 1, name: /Próximas fechas/ })).toBeVisible();
    await expect(pagina.getByRole("list", { name: "Apuntes" })).toHaveCount(0);
    await contexto.close();
  });

  test("plato nuevo: se ofrece añadirlo a los platos al apuntar una comida y al elegir una cena", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/calendario");
    const comida = pagina.getByRole("region", { name: "Comida del mediodía" });
    await comida.getByLabel("Qué se come").fill("Fideuà de la abuela");
    await comida.getByRole("button", { name: "Apuntar", exact: true }).click();
    await expect(
      comida.getByRole("group", { name: /Fideuà de la abuela no está en vuestros platos/ }),
    ).toBeVisible();
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await comida.getByRole("button", { name: "Añadir a mis platos y apuntarlo" }).click();
    await expect(comida.getByText("Fideuà de la abuela")).toBeVisible();

    // Ya es un plato de la casa: la próxima vez se apunta sin preguntar.
    await comida.getByRole("button", { name: /^Quitar comida/ }).click();
    await comida.getByLabel("Qué se come").fill("fideua de la abuela");
    await comida.getByRole("button", { name: "Apuntar", exact: true }).click();
    await expect(comida.getByRole("group")).toHaveCount(0);
    await expect(comida.getByText("Fideuà de la abuela")).toBeVisible();

    // Aparece en «Platos» pidiendo sus ingredientes.
    await pagina.goto("/menu/platos", { waitUntil: "networkidle" });
    await expect(pagina.getByText("Faltan los ingredientes").first()).toBeVisible();
    await contexto.close();
  });

  test("cena: nota del día y plato nuevo escribiendo el nombre, sin abrir listas", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/calendario");
    // Plato nuevo directamente en el campo siempre visible.
    // Un día sin cena elegida: el campo para poner un plato está a la vista desde el principio.
    await pagina.getByRole("button", { name: /^Lunes 9 de noviembre/ }).click();
    const campo = pagina.getByRole("textbox", { name: /¿Otro plato\?|Añadir un plato/ });
    await campo.fill("Lomo con pimientos");
    await pagina.getByRole("button", { name: /Crear «Lomo con pimientos» y elegirlo/ }).click();
    await expect(pagina.getByText("Lomo con pimientos").first()).toBeVisible();
    // Nota de la cena: se guarda al salir del campo y queda al recargar.
    const nota = pagina.getByRole("textbox", { name: "Nota de la cena" });
    await nota.fill("o igual pollo, depende");
    await nota.blur();
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: /^Lunes 9 de noviembre/ }).click();
    await expect(pagina.getByRole("textbox", { name: "Nota de la cena" })).toHaveValue(
      "o igual pollo, depende",
    );
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await contexto.close();
  });

  test("compra: filas compactas, cantidad y nombre editables, vistas y «no hace falta»", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/compra");
    // Compacta como Keep: caben muchas filas en una pantalla de móvil.
    const filas = pagina.getByRole("listitem").filter({ has: pagina.getByRole("checkbox") });
    const visibles = await filas.evaluateAll(
      (els) => els.filter((e) => e.getBoundingClientRect().bottom < window.innerHeight).length,
    );
    expect(visibles).toBeGreaterThanOrEqual(5);

    // Apuntar con cantidad, y editar nombre y cantidad en el sitio.
    await pagina.getByLabel("Añadir algo a la lista").fill("huevos 12");
    await pagina.getByRole("button", { name: "Añadir", exact: true }).click();
    const fila = pagina
      .getByRole("listitem")
      .filter({ hasText: "Huevos" })
      .filter({ hasText: "12" });
    await expect(fila.first()).toBeVisible();
    await fila
      .first()
      .getByRole("button", { name: /Huevos/ })
      .click();
    await pagina.getByLabel("Cantidad de Huevos").fill("6");
    await pagina.getByLabel("Nombre de Huevos").fill("Huevos camperos");
    await pagina.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      pagina.getByRole("listitem").filter({ hasText: "Huevos camperos" }).filter({ hasText: "6" }),
    ).toBeVisible();

    // Cantidad de un artículo calculado por el menú: + sube, restablecer vuelve.
    const calculada = pagina.getByRole("button", { name: /^Calabacín/ }).first();
    await calculada.click();
    await pagina.getByRole("button", { name: "Más Calabacín" }).click();
    await expect(pagina.getByText(/La app calculó/)).toBeVisible();
    await pagina.getByRole("button", { name: "Restablecer Calabacín" }).click();
    await expect(pagina.getByText(/La app calculó/)).toHaveCount(0);

    // «No hace falta» lo manda abajo y se puede volver a poner.
    await pagina.getByRole("button", { name: "No hace falta Calabacín" }).click();
    await expect(pagina.getByRole("button", { name: /^Calabacín/ })).toHaveCount(0);
    await pagina.getByText(/No hace falta \(1\)/).click();
    await pagina.getByRole("button", { name: "Volver a poner Calabacín" }).click();
    await expect(pagina.getByRole("button", { name: /^Calabacín/ }).first()).toBeVisible();

    // Vistas: la elegida se recuerda; «Tienda» no se edita; «Por comida» agrupa por motivo.
    await pagina.getByRole("button", { name: "Por comida", exact: true }).click();
    await expect(pagina.getByRole("heading", { name: /Cena del/ }).first()).toBeVisible();
    await pagina.getByRole("button", { name: "Tienda", exact: true }).click();
    await expect(pagina.getByLabel("Añadir algo a la lista")).toHaveCount(0);
    await pagina.reload({ waitUntil: "networkidle" });
    await expect(pagina.getByRole("button", { name: "Tienda", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await contexto.close();
  });

  test("familia: añadir a alguien, cambiar su ración y dejar de contarlo", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/personas");
    await pagina.getByLabel("Nombre", { exact: true }).last().fill("Lola");
    await pagina.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(pagina.getByRole("heading", { name: "Familia" })).toBeVisible();
    await expect(pagina.locator('input[value="Lola"]')).toHaveCount(1);
    await pagina.getByRole("button", { name: "Ya no cuenta Lola" }).click();
    await expect(pagina.getByRole("button", { name: "Volver a contar a Lola" })).toBeVisible();
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await contexto.close();
  });

  test("casa: plantilla, hoy toca, hecha se reprograma, reparto y aviso en la portada", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/casa");
    await pagina.getByRole("button", { name: "Añadir la plantilla de la casa" }).click();
    const hoy = pagina.getByRole("list", { name: "Hoy toca" });
    await expect(
      hoy.getByRole("listitem").filter({ hasText: /Cambiar las sábanas de mamá y papá/ }),
    ).toHaveCount(1);
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);

    // Reparto entre los dos: todas con responsable y «Tuya» en las de Diego.
    await pagina.getByRole("button", { name: /Repartir las \d+ sin responsable/ }).click();
    await expect(pagina.getByRole("button", { name: /Repartir las/ })).toHaveCount(0);
    await expect(pagina.getByText("Tuya").first()).toBeVisible();

    // En la portada aparece lo que le toca hoy (a quien tiene la tarea o a los dos).
    await pagina.goto("/", { waitUntil: "networkidle" });
    await pagina
      .getByRole("button", { name: /Marcar hecha: Cambiar las sábanas de mamá y papá/ })
      .click();
    await pagina.goto("/casa", { waitUntil: "networkidle" });
    await expect(
      pagina.getByRole("list", { name: "Hoy toca" }).getByText(/sábanas de mamá y papá/),
    ).toHaveCount(0);
    await expect(pagina.getByText(/sábanas de mamá y papá/).first()).toBeVisible(); // ahora en «Más adelante»
    await expect(pagina.getByText(/última vez/).first()).toBeVisible();

    // Una propia.
    await pagina.getByLabel("Qué hay que hacer").fill("Regar las plantas");
    await pagina.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(pagina.getByRole("listitem").filter({ hasText: "Regar las plantas" })).toHaveCount(
      1,
    );
    await contexto.close();
  });

  test("gatos: areneros cada día y arena y comida a la lista de la compra", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/casa");
    await pagina.getByRole("button", { name: "🐱 Añadir lo de los gatos" }).click();
    const hoy = pagina.getByRole("list", { name: "Hoy toca" });
    await expect(hoy.getByRole("listitem").filter({ hasText: /Limpiar los areneros/ })).toHaveCount(
      1,
    );
    await pagina
      .getByRole("button", { name: /Comprar arena para los gatos/, expanded: false })
      .click(); // abre la fila
    await pagina.getByRole("button", { name: "A la lista de la compra: Arena para gatos" }).click();
    await pagina.goto("/compra", { waitUntil: "networkidle" });
    await expect(pagina.getByText("Arena para gatos").first()).toBeVisible();
    await pagina.goto("/casa", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: "Marcar hecha: Limpiar los areneros" }).click();
    await expect(
      pagina
        .getByRole("list", { name: "Hoy toca" })
        .getByRole("listitem")
        .filter({ hasText: /Limpiar los areneros/ }),
    ).toHaveCount(0);
    await contexto.close();
  });

  test("comidas: se piensan en el calendario (texto, «por decidir» o plato) y salen en la portada", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/calendario");
    const comida = pagina.getByRole("region", { name: "Comida del mediodía" });
    await expect(comida.getByText("Sin comida pensada.")).toBeVisible();
    await comida.getByLabel("Qué se come").fill("Paella en casa de los abuelos");
    await comida.getByRole("button", { name: "Apuntar", exact: true }).click();
    await comida.getByRole("button", { name: "Solo apuntarlo esta vez" }).click();
    await expect(comida.getByText("Paella en casa de los abuelos")).toBeVisible();
    await comida.getByRole("button", { name: /Por decidir/ }).click();
    await expect(comida.getByRole("button", { name: "Quitar comida: Por decidir" })).toBeVisible();
    await comida.getByRole("button", { name: /Elegir un plato/ }).click();
    await comida
      .getByRole("button", { name: /^Comer / })
      .first()
      .click();
    await expect(comida.getByRole("button", { name: /^Quitar comida/ })).toHaveCount(3);
    // La portada la enseña y el día lleva ☀️ en el calendario.
    await expect(pagina.getByText("☀️ hay comida apuntada", { exact: false })).toBeVisible();
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await pagina.goto("/", { waitUntil: "networkidle" });
    await expect(pagina.getByText(/Comida: Paella en casa de los abuelos/)).toBeVisible();
    await contexto.close();
  });

  test("navegación: cuatro pilares y «Más», y todas las pantallas a dos toques", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/");
    const principal = pagina.getByRole("navigation", { name: "Principal" });
    await expect(principal.getByRole("link")).toHaveText([/Hoy/, /Comer/, /Casa/, /Fechas/, /Más/]);
    await expect(principal.getByRole("link", { name: "Hoy" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // La portada ya no es un menú de botones: lo que cuelga de un pilar no está suelto.
    for (const suelto of [/Zafarrancho/, /^🏠 Casa$/, /Fechas/, /Cumples/]) {
      await expect(pagina.getByRole("main").getByRole("link", { name: suelto })).toHaveCount(0);
    }

    const recorrido: Array<[string, string, string]> = [
      ["Comer", "Cena", "/menu"],
      ["Comer", "Cole", "/menu/cole"],
      ["Comer", "Compra", "/compra"],
      ["Comer", "Despensa", "/despensa"],
      ["Comer", "Platos", "/menu/platos"],
      ["Casa", "Recurrente", "/casa"],
      ["Casa", "Por persona", "/tareas"],
      ["Casa", "Reparto", "/reparto"],
      ["Fechas", "Próximas", "/fechas"],
      ["Fechas", "Calendario", "/calendario"],
      ["Fechas", "Cumples", "/cumples"],
      ["Más", "Cuenta", "/cuenta"],
      ["Más", "Enviar", "/compartir"],
    ];
    for (const [pilar, pestana, ruta] of recorrido) {
      await pagina.goto("/", { waitUntil: "networkidle" });
      await principal.getByRole("link", { name: pilar }).click();
      await pagina
        .getByRole("navigation", { name: "Apartados" })
        .getByRole("link", { name: pestana })
        .click();
      await pagina.waitForURL(`**${ruta}`);
      await expect(pagina.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(principal.getByRole("link", { name: pilar })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(
        pagina.getByRole("navigation", { name: "Apartados" }).getByRole("link", { name: pestana }),
      ).toHaveAttribute("aria-current", "page");
    }
    await contexto.close();
  });

  test("compartir: cada pantalla manda por WhatsApp lo que enseña, con comidas, fechas y casa", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    const mensaje = async () => {
      const href =
        (await pagina
          .getByRole("link", { name: "Enviar por WhatsApp" })
          .first()
          .getAttribute("href")) ?? "";
      expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
      return decodeURIComponent(href.replace("https://wa.me/?text=", ""));
    };
    // La comida del mediodía entra en el mensaje del menú.
    await cargar(pagina, "/calendario");
    const comida = pagina.getByRole("region", { name: "Comida del mediodía" });
    await comida.getByLabel("Qué se come").fill("Paella de los domingos");
    await comida.getByRole("button", { name: "Apuntar", exact: true }).click();
    await comida.getByRole("button", { name: "Solo apuntarlo esta vez" }).click();
    await pagina.goto("/menu", { waitUntil: "networkidle" });
    expect(await mensaje()).toContain("☀️ Paella de los domingos");
    // La compra, desde la propia lista.
    await pagina.goto("/compra", { waitUntil: "networkidle" });
    expect(await mensaje()).toContain("🛒 *Lista de la compra*");
    // Las fechas apuntadas.
    await pagina.goto("/fechas", { waitUntil: "networkidle" });
    await pagina.getByLabel(/Escribe como en una nota/).fill("5 Noviembre 18:15 Psicotécnico");
    await pagina.getByRole("button", { name: "Apuntar", exact: true }).click();
    await expect(pagina.getByRole("list", { name: "Apuntes" })).toBeVisible();
    expect(await mensaje()).toMatch(/Psicotécnico/);
    expect(await mensaje()).toContain("18:15");
    // Lo que toca en casa, agrupado por quién.
    await pagina.goto("/casa", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: "Añadir la plantilla de la casa" }).click();
    await pagina.getByRole("button", { name: /Repartir las/ }).click();
    const casa = await mensaje();
    expect(casa).toContain("🏠 *Lo que toca en casa*");
    expect(casa).toMatch(/\*(Diego|Ana)\*/);
    // «Copiar» avisa y «Compartir…» solo sale si el navegador lo ofrece.
    await pagina.getByRole("button", { name: "Copiar" }).click();
    await expect(
      pagina.getByRole("status").filter({ hasText: /Copiado|No se ha podido copiar/ }),
    ).toBeVisible();
    await contexto.close();
  });

  test("copia de seguridad: se descarga, se cambia algo, se restaura el archivo y vuelve", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    // Un apunte que sí queremos conservar.
    await cargar(pagina, "/fechas");
    await pagina.getByLabel(/Escribe como en una nota/).fill("5 Noviembre Excursión Emma");
    await pagina.getByRole("button", { name: "Apuntar", exact: true }).click();
    await expect(pagina.getByRole("list", { name: "Apuntes" })).toBeVisible();

    await pagina.goto("/cuenta", { waitUntil: "networkidle" });
    const descarga = pagina.waitForEvent("download");
    await pagina.getByRole("button", { name: "Descargar copia de este móvil" }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(
      /^respaldo-menus-semanales-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const ruta = await archivo.path();
    const contenido = JSON.parse(readFileSync(ruta, "utf8"));
    expect(contenido).toMatchObject({ app: "menus-semanales", version: 1, motivo: "manual" });
    expect(contenido.estado.agenda.map((a: { titulo: string }) => a.titulo)).toContain(
      "Excursión Emma",
    );

    // Se quita el apunte y se comprueba que ya no está.
    await pagina.goto("/fechas", { waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: "Quitar Excursión Emma" }).first().click();
    await expect(pagina.getByRole("list", { name: "Apuntes" })).toHaveCount(0);

    // Un archivo que no vale se rechaza con un motivo.
    await pagina.goto("/cuenta", { waitUntil: "networkidle" });
    const entrada = pagina.locator('input[type="file"]');
    await entrada.setInputFiles({
      name: "malo.json",
      mimeType: "application/json",
      buffer: Buffer.from("{no json"),
    });
    await expect(
      pagina.getByRole("status").filter({ hasText: /No es un archivo de copia/ }),
    ).toBeVisible();

    // Restaurar el bueno: pide confirmar y devuelve el apunte.
    await entrada.setInputFiles(ruta);
    await expect(
      pagina.getByRole("alert").filter({ hasText: /sustituye todo lo de este móvil/ }),
    ).toBeVisible();
    await pagina.getByRole("button", { name: "Sí, sustituir lo de este móvil" }).click();
    await expect(pagina.getByRole("status").filter({ hasText: "Copia restaurada" })).toBeVisible();
    await pagina.goto("/fechas", { waitUntil: "networkidle" });
    await expect(
      pagina.getByRole("list", { name: "Apuntes" }).getByText(/Excursión Emma/),
    ).toBeVisible();
    await contexto.close();
  });

  test("menú: apuntar la comida del mediodía además de la cena, desde Comer", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await pagina.getByRole("button", { name: /Jueves 5 de noviembre/ }).click();
    const comida = pagina.getByRole("region", { name: "Comida del mediodía" });
    await comida.getByLabel("Qué se come").fill("Paella de los abuelos");
    await comida.getByRole("button", { name: "Apuntar", exact: true }).click();
    await comida.getByRole("button", { name: "Solo apuntarlo esta vez" }).click();
    await expect(comida.getByText("Paella de los abuelos")).toBeVisible();
    // Se ve también en la fila del día, plegada.
    await pagina.getByRole("button", { name: /Jueves 5 de noviembre/ }).click();
    await expect(pagina.getByText("Paella de los abuelos").first()).toBeVisible();
    await contexto.close();
  });

  test("avisos: la campanita enseña lo de hoy y el número se borra al abrirla", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/");
    // Una cita de hoy es algo que pide atención.
    const rapida = pagina.getByRole("region", { name: "Citas y eventos" });
    await rapida.getByRole("button", { name: "＋ Cita" }).click();
    await rapida.getByLabel("Qué hay que apuntar").fill("Reunión de hoy");
    await rapida.getByRole("button", { name: "＋ Apuntar" }).click();
    const campana = pagina.getByRole("button", { name: /^Avisos/ });
    await expect(campana).toContainText(/nuevo/);
    await campana.click();
    const panel = pagina.getByRole("dialog", { name: "Avisos de hoy" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Hoy: Reunión de hoy")).toBeVisible();
    await pagina.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(pagina.getByRole("button", { name: /^Avisos$/ })).toBeVisible(); // sin «nuevos»
    await contexto.close();
  });

  test("avisos: la pantalla de enviar ofrece las notificaciones y la campanita lleva a ella", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/");
    await pagina.getByRole("button", { name: /^Avisos/ }).click();
    await pagina.getByRole("link", { name: /Recibir estos avisos en el móvil/ }).click();
    await expect(pagina).toHaveURL(/\/compartir$/);
    const tarjeta = pagina.getByRole("region", { name: "Notificaciones en el móvil" });
    await expect(tarjeta).toBeVisible();
    // Sin nube configurada en esta versión de prueba, pide entrar primero.
    await expect(tarjeta.getByText(/Primero entra con tu cuenta/)).toBeVisible();
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await contexto.close();
  });

  test("platos: completar un plato con IA (respuesta simulada) y guardarlo con sus ingredientes", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await pagina.route("**/api/ia/plato", (ruta) =>
      ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          propuesta: {
            grupo: "carne",
            minutosActivos: 25,
            ligero: false,
            pasos: "Empana el pollo y fríelo.",
            ingredientes: [
              {
                nombre: "Pechuga de pollo",
                cantidad: 150,
                unidad: "g",
                seccion: "carne",
                opcional: false,
              },
              {
                nombre: "Ingrediente raro de prueba",
                cantidad: 30,
                unidad: "g",
                seccion: "otros",
                opcional: false,
              },
            ],
          },
          usadas: 1,
          limite: 40,
        }),
      }),
    );
    await cargar(pagina, "/menu/platos");
    await pagina.getByRole("button", { name: "Nuevo plato" }).click();
    await pagina.getByLabel("Nombre", { exact: true }).fill("Pollo empanado de prueba");
    await pagina.getByRole("button", { name: "✨ Completar con IA" }).click();
    const propuesta = pagina.getByRole("group", { name: "Propuesta de la IA" });
    await expect(propuesta).toBeVisible();
    await expect(propuesta.getByText(/Ingrediente raro de prueba/)).toBeVisible();
    await expect(propuesta.getByText("nuevo")).toBeVisible();
    await propuesta.getByRole("button", { name: "Usar esta propuesta" }).click();
    await expect(pagina.getByLabel(/Minutos de trabajo/)).toHaveValue("25");
    await pagina.getByRole("button", { name: "Guardar plato" }).click();
    await expect(pagina.getByText("Pollo empanado de prueba").first()).toBeVisible();
    await expect(pagina.getByText(/2 ingredientes/).first()).toBeVisible();
    await contexto.close();
  });

  test("fechas: leer una circular del cole con IA (respuesta simulada) y apuntar lo elegido", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await pagina.route("**/api/ia/circular", (ruta) =>
      ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              tipo: "cita",
              titulo: "Excursión al zoo de prueba",
              fecha: "2026-11-20",
              hasta: null,
              hora: "09:00",
            },
            {
              tipo: "tarea",
              titulo: "Firmar la autorización de prueba",
              fecha: null,
              hasta: null,
              hora: null,
            },
            {
              tipo: "cita",
              titulo: "No quiero esta de prueba",
              fecha: "2026-11-25",
              hasta: null,
              hora: null,
            },
          ],
          pasados: 1,
          usadas: 1,
          limite: 40,
        }),
      }),
    );
    await cargar(pagina, "/fechas");
    await pagina.getByRole("button", { name: "✨ Leer una circular del cole" }).click();
    const circular = pagina.getByRole("region", { name: "Leer una circular del cole" });
    await circular.getByLabel("…o pega el texto").fill("Excursión al zoo el 20 de noviembre");
    await circular.getByRole("button", { name: "Leer el texto" }).click();
    await expect(circular.getByText(/Revísalo/)).toBeVisible();
    await expect(circular.getByText(/1 cosa ya pasada/)).toBeVisible();
    await circular.getByLabel(/Apuntar:.*Cita.*25 nov/).uncheck();
    await circular.getByRole("button", { name: "Apuntar 2 cosas" }).click();
    await expect(pagina.getByText("Excursión al zoo de prueba").first()).toBeVisible();
    await expect(pagina.getByText("No quiero esta de prueba")).toHaveCount(0);
    await contexto.close();
  });

  test("enviar: el menú se puede mandar como agenda, tabla o completo", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/compartir");
    const tarjeta = pagina.getByRole("region", { name: /^Menú/ });
    const mensaje = async () =>
      decodeURIComponent(
        (
          (await tarjeta.getByRole("link", { name: "Enviar por WhatsApp" }).getAttribute("href")) ??
          ""
        ).replace("https://wa.me/?text=", ""),
      );
    // Por defecto, la agenda: sin el «porqué» de cada cena.
    await expect(tarjeta.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await mensaje()).not.toContain("💡");
    await tarjeta.getByRole("button", { name: "Tabla" }).click();
    expect(await mensaje()).toMatch(/\*[^*]+\* \| .* \| /);
    await tarjeta.getByRole("button", { name: "Completo" }).click();
    expect(await mensaje()).toContain("🍴");
    // Se recuerda al volver.
    await pagina.reload({ waitUntil: "networkidle" });
    await expect(tarjeta.getByRole("button", { name: "Completo" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await contexto.close();
  });

  test("enviar: WhatsApp, copiar y archivo de calendario", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/compartir");
    const whatsapp = pagina.getByRole("link", { name: "Enviar por WhatsApp" });
    await expect(whatsapp).toHaveCount(4); // menú, compra, fechas y casa
    // Los avisos en el calendario del móvil piden primero la cuenta (aquí no hay nube).
    const avisos = pagina.getByRole("region", { name: "Avisos en el calendario del móvil" });
    await expect(avisos.getByText(/con la app cerrada/)).toBeVisible();
    await expect(avisos.getByText(/Primero entra con tu cuenta/)).toBeVisible();
    await expect(avisos.getByRole("button", { name: /Activar los avisos/ })).toHaveCount(0);
    expect(await whatsapp.first().getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    await pagina.getByText("Ver mensaje").first().click();
    await expect(pagina.locator("pre").first()).toContainText("Hecho con Menús Semanales");
    // El archivo de calendario se descarga con eventos de cena.
    const descarga = pagina.waitForEvent("download");
    await pagina.getByRole("button", { name: /Calendario \(\.ics\)/ }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe("menus-semanales.ics");
    await expect(
      pagina.getByRole("status").filter({ hasText: "Archivo descargado" }),
    ).toBeVisible();
    await contexto.close();
  });

  test("calendario: lo mismo al elegir y cancelar", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/calendario");
    await pagina.getByRole("button", { name: /^Sábado 7 de noviembre/ }).click();
    const elegir = pagina.getByRole("button", { name: /^Elegir / });
    await expect(elegir).toHaveCount(3);
    await elegir.first().click();
    await expect(elegir).toHaveCount(0);
    await pagina.getByRole("button", { name: /^Quitar / }).click();
    await expect(elegir).toHaveCount(3);
    await contexto.close();
  });

  test("compra: varias cosas de una vez, sugerencias y «lo de siempre»", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/compra");
    await pagina.getByLabel("Añadir algo a la lista").fill("pañales, cervezas y bolsas de basura");
    await pagina.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(pagina.getByRole("checkbox", { name: /Pañales/ })).toBeVisible();
    await expect(pagina.getByRole("checkbox", { name: /Cervezas/ })).toBeVisible();
    await expect(pagina.getByRole("checkbox", { name: /Bolsas de basura/ })).toBeVisible();
    // Cada cosa en su sección del súper.
    await expect(pagina.getByRole("heading", { level: 2, name: /Higiene y bebé/ })).toBeVisible();
    await expect(pagina.getByRole("heading", { level: 2, name: /Bebidas/ })).toBeVisible();
    // Sugerencia mientras se escribe.
    await pagina.getByLabel("Añadir algo a la lista").fill("kef");
    await pagina.getByRole("button", { name: "+ Kéfir" }).click();
    await expect(pagina.getByRole("checkbox", { name: /Kéfir/ })).toBeVisible();
    // «Lo de siempre»: un toque.
    await pagina.getByText(/Lo de siempre/).click();
    const siempre = pagina.getByRole("list", { name: "Lo de siempre" });
    await siempre.getByRole("button", { name: "+ Plátanos" }).click();
    await expect(pagina.getByRole("checkbox", { name: /Plátanos/ })).toBeVisible();
    await expect(siempre.getByRole("button", { name: "+ Plátanos" })).toHaveCount(0);
    await contexto.close();
  });

  test("botón flotante: apuntar a la compra desde cualquier pantalla", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await pagina.getByRole("button", { name: "Apuntar a la lista de la compra" }).click();
    const dialogo = pagina.getByRole("dialog", { name: "Apuntar a la lista de la compra" });
    await dialogo.getByLabel("Añadir algo a la lista").fill("crema solar y pilas");
    await dialogo.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(
      pagina.getByRole("status").filter({ hasText: "Añadido: Crema solar, Pilas." }),
    ).toBeVisible();
    await pagina.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);
    await pagina.getByRole("link", { name: "Compra" }).click();
    await expect(pagina.getByRole("checkbox", { name: /Crema solar/ })).toBeVisible();
    await expect(
      pagina.getByRole("button", { name: "Apuntar a la lista de la compra" }),
    ).toHaveCount(0);
    await contexto.close();
  });

  test("tareas: las tareas hechas dan estrellas y se canjean por premios", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/tareas");
    await pagina.getByRole("button", { name: /^Alba/ }).click();
    await pagina.getByLabel("Añadir una tarea a Alba").fill("recoger la mesa");
    await pagina.getByRole("button", { name: "Añadir", exact: true }).click();
    await pagina.getByRole("checkbox", { name: /Recoger la mesa/ }).check();
    await expect(pagina.getByLabel(/estrellas para gastar/)).toHaveAttribute(
      "aria-label",
      /^[1-9]\d* estrellas para gastar/,
    );
    await expect(pagina.getByText(/1 día seguido haciendo tareas/)).toBeVisible();
    await expect(pagina.getByText("Primera estrella")).toBeVisible();
    // Sin premios se ofrecen los de ejemplo; con coste alto no se puede canjear aún.
    await pagina.getByRole("button", { name: "Poner premios de ejemplo" }).click();
    await expect(pagina.getByRole("button", { name: /^Canjear Plan especial/ })).toBeDisabled();
    // Un premio barato propio sí.
    await pagina.getByRole("button", { name: "Editar" }).click();
    await pagina.getByLabel("Nombre del premio").fill("Un abrazo");
    await pagina.getByLabel("Estrellas que cuesta").fill("1");
    await pagina.getByRole("button", { name: "Añadir premio" }).click();
    await pagina.getByRole("button", { name: "Listo" }).click();
    await pagina.getByRole("button", { name: /^Canjear Un abrazo/ }).click();
    await expect(pagina.getByRole("status")).toContainText("ha conseguido: Un abrazo");
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: /^Alba/ }).click();
    await expect(pagina.getByRole("button", { name: "Devolver Un abrazo" })).toBeVisible();
    await pagina.getByRole("button", { name: "Devolver Un abrazo" }).click();
    await expect(pagina.getByRole("button", { name: "Devolver Un abrazo" })).toHaveCount(0);
    await contexto.close();
  });

  test("tareas: apuntar para una persona, marcar, recargar y quitar", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/tareas");
    await pagina.getByRole("button", { name: /^Alba/ }).click();
    await pagina.getByLabel("Añadir una tarea a Alba").fill("deberes y recoger la mesa");
    await pagina.getByLabel("Se repite cada día").check();
    await pagina.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(pagina.getByRole("checkbox", { name: /Deberes/ })).toBeVisible();
    await pagina.getByRole("checkbox", { name: /Deberes/ }).check();
    await expect(pagina.getByText("1 de 2", { exact: true })).toBeVisible();
    await expect(pagina.getByText("Familia: 1 de 2")).toBeVisible();
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.getByRole("button", { name: /^Alba/ }).click();
    await expect(pagina.getByRole("checkbox", { name: /Deberes/ })).toBeChecked();
    // Otra persona no ve las tareas de Alba.
    await pagina.getByRole("button", { name: /^Ana/ }).click();
    await expect(pagina.getByRole("checkbox", { name: /Deberes/ })).toHaveCount(0);
    await pagina.getByRole("button", { name: /^Alba/ }).click();
    await pagina.getByRole("button", { name: "Editar" }).click();
    await pagina.getByRole("button", { name: "Quitar la tarea Deberes" }).click();
    await expect(pagina.getByRole("checkbox", { name: /Deberes/ })).toHaveCount(0);
    await contexto.close();
  });

  test("despensa: repasar qué queda poco lo apunta a la compra y se ve el contador", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/despensa");
    await pagina.getByText(/Revisar qué queda poco/).click();
    const kefir = pagina.getByRole("button", { name: /Kéfir/ });
    await kefir.click();
    await expect(kefir).toHaveAttribute("aria-pressed", "true");
    await expect(pagina.getByText(/\d+ en la lista/).first()).toBeVisible();
    await expect(pagina.getByRole("link", { name: /\(\d+ pendientes\)/ })).toBeVisible();
    await pagina.getByRole("link", { name: /Compra/ }).click();
    await expect(pagina.getByRole("checkbox", { name: /Kéfir/ })).toBeVisible();
    // Tocarlo otra vez lo quita.
    await pagina.getByRole("link", { name: /Despensa/ }).click();
    await pagina.getByText(/Revisar qué queda poco/).click();
    await pagina.getByRole("button", { name: /Kéfir/ }).click();
    await expect(pagina.getByRole("button", { name: /Kéfir/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await contexto.close();
  });

  test("perfiles: se elige quién eres, se saluda por el nombre y se puede cambiar", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844, "light", null);
    await cargar(pagina, "/");
    await expect(pagina.getByRole("heading", { level: 1, name: "¿Quién eres?" })).toBeVisible();
    for (const nombre of ["Diego", "Ana"]) {
      await expect(pagina.getByRole("button", { name: nombre, exact: true })).toBeVisible();
    }
    // Sin perfil no se enseña nada más (ni navegación).
    await expect(pagina.getByRole("navigation")).toHaveCount(0);
    const axe = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);

    await pagina.getByRole("button", { name: "Ana", exact: true }).click();
    await expect(pagina.getByText("¡Hola, Ana! 👋")).toBeVisible();
    await expect(pagina.getByRole("link", { name: /Preparar un regalo/ })).toHaveCount(0);
    await pagina.reload({ waitUntil: "networkidle" });
    await expect(pagina.getByText("¡Hola, Ana! 👋")).toBeVisible();

    await pagina.getByRole("button", { name: /Cambiar de perfil/ }).click();
    await expect(pagina.getByRole("heading", { level: 1, name: "¿Quién eres?" })).toBeVisible();
    await pagina.getByRole("button", { name: "Diego", exact: true }).click();
    await expect(pagina.getByText("¡Hola, Diego! 👋")).toBeVisible();
    await expect(pagina.getByRole("link", { name: /Preparar un regalo/ })).toBeVisible();
    await contexto.close();
  });

  test("menú: ver todos los platos ordenados, con el motivo de lo que no encaja, y elegir uno", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/menu");
    await pagina.getByRole("button", { name: "📚 Ver todos los platos" }).click();
    const lista = pagina.getByRole("list", { name: "Catálogo ordenado" });
    await expect(pagina.getByText(/platos · \d+ encajan/)).toBeVisible();
    // El primero encaja; más abajo hay platos que no, y dicen por qué.
    await expect(lista.getByRole("listitem").first()).toContainText("✓ Encaja");
    await pagina.getByLabel("Buscar en todos los platos").fill("tortilla");
    await expect(lista.getByText(/⚠️/).first()).toBeVisible();
    // Se puede elegir aunque no encaje: la app avisa, no impide.
    await pagina.getByLabel("Buscar en todos los platos").fill("pisto");
    await lista.getByRole("button", { name: /^Elegir Pisto/ }).click();
    await expect(pagina.getByRole("button", { name: /^Quitar Pisto/ })).toBeVisible();
    await contexto.close();
  });

  test("cumples: añadir, avisar un mes antes, pensar ideas y la sorpresa no se enseña a quien cumple", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await cargar(pagina, "/cumples");
    await pagina.getByLabel("Nombre").fill("Lucas");
    await pagina.getByLabel(/Fecha/).fill("20/11/2017");
    await pagina.getByRole("button", { name: "Guardar cumpleaños" }).click();
    await pagina.getByText("Pegar varios de una vez").click();
    await pagina.getByLabel(/Uno por línea/).fill("Ana 10/11\nAbuela Rosa 20 de enero");
    await pagina.getByRole("button", { name: "Guardar todos" }).click();
    await expect(pagina.getByRole("heading", { level: 2, name: /Lucas/ })).toBeVisible();

    // Fecha mal escrita: lo dice.
    await pagina.getByLabel("Nombre").fill("Error");
    await pagina.getByLabel(/Fecha/).fill("31/2");
    await pagina.getByRole("button", { name: "Guardar cumpleaños" }).click();
    await expect(
      pagina.getByRole("alert").filter({ hasText: "No entiendo la fecha" }),
    ).toBeVisible();

    // Lucas: ideas y estado.
    await pagina.getByRole("button", { name: /Lucas/ }).click();
    await pagina
      .getByRole("button", { name: /^\+ Libro/ })
      .first()
      .click();
    await expect(pagina.getByRole("button", { name: /^Quitar la idea Libro/ })).toBeVisible();
    await pagina.getByRole("button", { name: "Comprado", exact: true }).click();
    await expect(pagina.getByRole("button", { name: "Comprado", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // La portada avisa de los que faltan menos de un mes.
    await pagina.goto("/", { waitUntil: "networkidle" });
    await expect(pagina.getByRole("heading", { level: 2, name: /Próximos cumples/ })).toBeVisible();
    await expect(pagina.getByText(/Ana.* en 6 días/)).toHaveCount(2); // cuenta atrás + tarjeta
    await expect(
      pagina
        .getByRole("list", { name: "Cuenta atrás" })
        .getByRole("listitem")
        .filter({ hasText: /Ana.* en 6 días/ }),
    ).toHaveCount(1);

    // Ana no ve las ideas de su propio cumple ni su aviso de regalo.
    await pagina.getByRole("button", { name: /Cambiar de perfil/ }).click();
    await pagina.getByRole("button", { name: "Ana", exact: true }).click();
    await expect(pagina.getByRole("heading", { level: 2, name: /Próximos cumples/ })).toHaveCount(
      0,
    );
    await pagina.goto("/cumples", { waitUntil: "networkidle" });
    await pagina
      .getByRole("main")
      .getByRole("button", { name: /^10 NOV|Ana/ })
      .first()
      .click();
    await expect(pagina.getByText(/Es sorpresa/)).toBeVisible();
    await expect(pagina.getByRole("heading", { level: 3, name: /Ideas para Ana/ })).toHaveCount(0);
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

test.describe("regalo en un enlace", () => {
  test("se prepara, el enlace se abre y muestra la felicitación sin ejecutar HTML", async ({
    browser,
  }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await pagina.goto("/regalo", { waitUntil: "networkidle" });
    await expect(
      pagina.getByRole("heading", { level: 1, name: /Preparar el regalo/ }),
    ).toBeVisible();
    await pagina.getByLabel("Para", { exact: true }).fill("Ana");
    await pagina.getByLabel(/Mensaje/).fill("Feliz cumple <img src=x onerror=window.__xss=1>");
    const enlace = await pagina.getByLabel("Enlace del regalo").inputValue();
    expect(enlace).toContain("/regalo#p=");

    await pagina.goto(new URL(enlace).pathname + new URL(enlace).hash, {
      waitUntil: "networkidle",
    });
    await expect(
      pagina.getByRole("heading", { level: 1, name: "¡Feliz cumpleaños, Ana!" }),
    ).toBeVisible();
    await expect(pagina.getByText("Feliz cumple <img src=x onerror=window.__xss=1>")).toBeVisible();
    expect(await pagina.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
    await expect(pagina.getByRole("link", { name: "Ver la aplicación" })).toBeVisible();

    const resultado = await new AxeBuilder({ page: pagina })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(resultado.violations.map((v) => v.id)).toEqual([]);
    await contexto.close();
  });

  test("un enlace de regalo roto vuelve a la pantalla de preparar", async ({ browser }) => {
    const { contexto, pagina } = await abrir(browser, 390, 844);
    await pagina.goto("/regalo#p=esto-no-vale", { waitUntil: "networkidle" });
    await expect(
      pagina.getByRole("heading", { level: 1, name: /Preparar el regalo/ }),
    ).toBeVisible();
    await contexto.close();
  });
});
