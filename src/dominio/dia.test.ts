import { describe, expect, it } from "vitest";
import { hoyDeAhora } from "./dia";
import { momentoDeHora } from "./momento";

describe("el día cambia a las 4:00 (D-201)", () => {
  const madrid = (iso: string) => hoyDeAhora(new Date(iso), "Europe/Madrid");
  it("a las 00:30 todavía es el día de antes", () => {
    expect(madrid("2026-11-20T23:30:00Z")).toBe("2026-11-20"); // 00:30 del 21 en Madrid
    expect(madrid("2026-11-21T02:59:00Z")).toBe("2026-11-20"); // 03:59
  });
  it("a las 4:00 empieza el día nuevo", () => {
    expect(madrid("2026-11-21T03:00:00Z")).toBe("2026-11-21"); // 04:00
    expect(madrid("2026-11-21T12:00:00Z")).toBe("2026-11-21");
    expect(madrid("2026-11-21T22:59:00Z")).toBe("2026-11-21"); // 23:59
  });
  it("también en verano (UTC+2)", () => {
    expect(madrid("2026-07-14T21:30:00Z")).toBe("2026-07-14"); // 23:30
    expect(madrid("2026-07-14T22:30:00Z")).toBe("2026-07-14"); // 00:30 del 15
    expect(madrid("2026-07-15T02:00:00Z")).toBe("2026-07-15"); // 04:00
  });
  it("el momento del día encaja: la madrugada hasta las 4 sigue siendo noche", () => {
    expect(momentoDeHora(0)).toBe("noche");
    expect(momentoDeHora(3)).toBe("noche");
    expect(momentoDeHora(4)).toBe("manana");
    expect(momentoDeHora(13)).toBe("tarde");
    expect(momentoDeHora(20)).toBe("noche");
  });
});
