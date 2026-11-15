import { describe, expect, it } from "vitest";
import { adjuntoParaLeer, codigoDeDireccion, textoDelCorreo } from "./correo-circular";

describe("circulares por correo (D-147)", () => {
  it("saca el código del hogar de la dirección, venga como venga escrita", () => {
    const c = "ab12cd34ef56gh78";
    expect(codigoDeDireccion([`hecho-${c}@xyz.resend.app`])).toBe(c);
    expect(
      codigoDeDireccion(["otra@x.com", `Familia <HECHO-${c.toUpperCase()}@xyz.resend.app>`]),
    ).toBe(c);
    expect(codigoDeDireccion(["hecho-corto@xyz.resend.app"])).toBeNull();
    expect(codigoDeDireccion([`nohecho-${c}@xyz.resend.app`])).toBeNull();
    expect(codigoDeDireccion([])).toBeNull();
  });

  it("el texto del correo, o el del HTML sin etiquetas", () => {
    expect(textoDelCorreo({ text: "  Excursión   el jueves\n\n\n14  " })).toBe(
      "Excursión el jueves\n14",
    );
    expect(
      textoDelCorreo({
        html: "<style>p{}</style><p>Reunión&nbsp;de padres</p><p>el <b>martes</b></p>",
      }),
    ).toBe("Reunión de padres\nel martes");
    expect(textoDelCorreo({})).toBe("");
  });

  it("elige el primer adjunto que se puede leer: PDF o foto, no muy grande", () => {
    const url = "https://descargas.ejemplo/a";
    expect(
      adjuntoParaLeer([
        { content_type: "text/calendar", size: 10, download_url: url },
        { content_type: "application/pdf", size: 50 * 1024 * 1024, download_url: url },
        { content_type: "image/jpeg; name=foto.jpg", size: 1000, download_url: url },
      ]),
    ).toEqual({ url, mime: "image/jpeg" });
    expect(
      adjuntoParaLeer([{ content_type: "application/pdf", size: 10, download_url: "http://x" }]),
    ).toBeNull();
    expect(adjuntoParaLeer([])).toBeNull();
  });
});
