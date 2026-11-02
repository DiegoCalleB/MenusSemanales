import { describe, expect, it } from "vitest";
import { interpretarAjustesAuth } from "./diagnostico-auth";

describe("interpretarAjustesAuth", () => {
  it("lee lo que Supabase cuenta de su acceso", () => {
    expect(
      interpretarAjustesAuth({
        external: { anonymous_users: true, email: true, google: false },
        disable_signup: false,
      }),
    ).toEqual({ anonimos: true, correo: true, registroAbierto: true });
    expect(
      interpretarAjustesAuth({
        external: { anonymous_users: false, email: true },
        disable_signup: true,
      }),
    ).toEqual({ anonimos: false, correo: true, registroAbierto: false });
  });

  it("lo que no dice, queda como desconocido; lo que no entiende, nada", () => {
    expect(interpretarAjustesAuth({ external: {} })).toEqual({
      anonimos: null,
      correo: null,
      registroAbierto: null,
    });
    expect(interpretarAjustesAuth({ external: { anonymous_users: "si" } })?.anonimos).toBeNull();
    for (const raro of [null, 5, "x", [], {}, { external: null }]) {
      expect(interpretarAjustesAuth(raro), JSON.stringify(raro)).toBeNull();
    }
  });
});
