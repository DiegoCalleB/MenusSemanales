import { describe, expect, it } from "vitest";
import { enlaceValido } from "./calendario-externo";

describe("enlace del calendario", () => {
  it("solo acepta HTTPS de calendar.google.com", () => {
    expect(enlaceValido("https://calendar.google.com/calendar/ical/x/private-y/basic.ics")).toBe(
      true,
    );
    expect(enlaceValido("http://calendar.google.com/calendar/ical/x")).toBe(false);
    expect(enlaceValido("https://evil.example/calendar.google.com")).toBe(false);
    expect(enlaceValido("https://calendar.google.com.evil.example/x")).toBe(false);
    expect(enlaceValido("no es una url")).toBe(false);
    expect(enlaceValido("")).toBe(false);
  });
});
