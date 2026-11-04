import { describe, expect, it } from "vitest";
import { URL_APP, enlaceDeApp, mensajeDeInvitacion } from "./enlaces";

describe("enlaces de la app", () => {
  it("la dirección es la definitiva, con https y sin barra final", () => {
    expect(URL_APP).toBe("https://yaestahecho.up.railway.app");
    expect(URL_APP.endsWith("/")).toBe(false);
  });

  it("completa una ruta con o sin barra inicial", () => {
    expect(enlaceDeApp("/cuenta")).toBe("https://yaestahecho.up.railway.app/cuenta");
    expect(enlaceDeApp("cuenta")).toBe("https://yaestahecho.up.railway.app/cuenta");
  });

  it("la invitación lleva la dirección definitiva y el código", () => {
    const m = mensajeDeInvitacion("ABCD-1234");
    expect(m).toContain("1. Abre https://yaestahecho.up.railway.app/cuenta");
    expect(m).toContain("escribe: ABCD-1234");
    expect(m.startsWith("Únete a nuestro hogar en ¡Hecho!")).toBe(true);
  });

  it("con nombre, saluda a la persona", () => {
    expect(mensajeDeInvitacion("X", "Ana").startsWith("Hola Ana 👋 Únete")).toBe(true);
  });
});
