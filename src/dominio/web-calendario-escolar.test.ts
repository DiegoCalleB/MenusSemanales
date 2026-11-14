import { describe, expect, it } from "vitest";
import { enlacesDelCurso } from "./web-calendario-escolar";

/** Trozo real de la página de la Comunidad de Madrid (octubre de 2026). */
const HTML = `
<a href="/themes/custom/cm_pcen/assets/micon/material-symbols/symbol-defs.svg#x">icono</a>
<a href="https://www.comunidad.madrid/docs/2026-06/bocm-131-04-06-2026_orden-2034-calendario-escolar-curso-2026-27.pdf?VersionId=po3LajAo9m6cZG1aVthUe8TvIXMRUAjs">Orden</a>
<a href="https://www.comunidad.madrid/docs/2026-10/calendario-escolar_26-27.pdf?VersionId=TMm19LC9asrZNLdrBtdv_avtVNWH77h8">Cuadro</a>
<a href="https://www.educa2.madrid.org/web/calendario-escolar-de-la-comunidad-de-madrid/calendario-escolar-26-27">Educa</a>
<a href="https://malo.example/calendario-escolar_27-28.pdf">De otro sitio</a>
`;

describe("los PDF del calendario escolar en la web (D-146)", () => {
  it("encuentra la orden y el cuadro del curso pedido", () => {
    expect(enlacesDelCurso(HTML, 2026)).toEqual({
      orden:
        "https://www.comunidad.madrid/docs/2026-06/bocm-131-04-06-2026_orden-2034-calendario-escolar-curso-2026-27.pdf?VersionId=po3LajAo9m6cZG1aVthUe8TvIXMRUAjs",
      cuadro:
        "https://www.comunidad.madrid/docs/2026-10/calendario-escolar_26-27.pdf?VersionId=TMm19LC9asrZNLdrBtdv_avtVNWH77h8",
    });
  });

  it("si aún no está publicado, nada; y nunca de otros sitios", () => {
    expect(enlacesDelCurso(HTML, 2027)).toEqual({ orden: null, cuadro: null });
    expect(
      enlacesDelCurso(`<a href="/docs/x/orden-calendario-escolar-curso-2027-28.pdf">`, 2027),
    ).toEqual({
      orden: "https://www.comunidad.madrid/docs/x/orden-calendario-escolar-curso-2027-28.pdf",
      cuadro: null,
    });
  });
});
