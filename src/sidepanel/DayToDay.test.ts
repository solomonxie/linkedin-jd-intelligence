import { describe, expect, it } from "vitest";
import { normalizeSplit } from "./DayToDay";

describe("normalizeSplit", () => {
  it("rescales percents that don't add up to 100", () => {
    expect(normalizeSplit([{ area: "Backend", percent: 70 }, { area: "Frontend", percent: 30 }])).toEqual([
      { area: "Backend", percent: 70 },
      { area: "Frontend", percent: 30 },
    ]);
    expect(normalizeSplit([{ area: "Backend", percent: 8 }, { area: "Frontend", percent: 2 }])).toEqual([
      { area: "Backend", percent: 80 },
      { area: "Frontend", percent: 20 },
    ]);
  });

  it("drops a split with nothing to scale against", () => {
    expect(normalizeSplit([])).toEqual([]);
    expect(normalizeSplit([{ area: "Backend", percent: 0 }])).toEqual([]);
    expect(normalizeSplit([{ area: "Backend", percent: Number.NaN }])).toEqual([]);
  });
});
