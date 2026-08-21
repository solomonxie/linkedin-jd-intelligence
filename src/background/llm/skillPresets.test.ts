import { describe, expect, it } from "vitest";
import { formatSkillPresetsForPrompt, SKILL_PRESETS } from "./skillPresets";

describe("SKILL_PRESETS", () => {
  it("has no duplicate skill names across categories", () => {
    const names = SKILL_PRESETS.flatMap((c) => c.skills.map((s) => s.skill));
    expect(new Set(names).size).toBe(names.length);
  });

  it("every implied skill is a brief phrase, not a sentence", () => {
    for (const category of SKILL_PRESETS) {
      for (const { skill, implies } of category.skills) {
        for (const implied of implies ?? []) {
          expect(implied.length, `${skill} -> ${implied}`).toBeLessThan(60);
        }
      }
    }
  });
});

describe("formatSkillPresetsForPrompt", () => {
  it("includes category names and skill->implies notation", () => {
    const text = formatSkillPresetsForPrompt();
    expect(text).toContain("Languages:");
    expect(text).toContain("Django(→Python,ORM,REST API design,web-app development)");
  });

  it("has one line per category", () => {
    const text = formatSkillPresetsForPrompt();
    expect(text.split("\n")).toHaveLength(SKILL_PRESETS.length);
  });
});
