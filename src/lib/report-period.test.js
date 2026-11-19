import { describe, expect, test } from "bun:test";
import { currentMonthRange } from "./report-period";

describe("current calendar month in São Paulo", () => {
  test("November starts on the first, not thirty days earlier", () => {
    expect(currentMonthRange(new Date("2026-11-19T18:43:00Z"))).toEqual({
      from: "2026-11-01T00:00:00.000-03:00",
      to: "2026-11-19T23:59:59.999-03:00",
    });
  });
  test("UTC month change does not advance the São Paulo month early", () => {
    expect(currentMonthRange(new Date("2026-12-01T02:59:59Z")).from).toBe("2026-11-01T00:00:00.000-03:00");
    expect(currentMonthRange(new Date("2026-12-01T03:00:00Z")).from).toBe("2026-12-01T00:00:00.000-03:00");
  });
});