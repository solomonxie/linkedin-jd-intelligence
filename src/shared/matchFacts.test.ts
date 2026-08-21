import { describe, expect, it } from "vitest";
import { countByTier, normalizeWeights } from "./matchFacts";
import type { RequirementNode } from "./types";

function node(overrides: Partial<RequirementNode>): RequirementNode {
  return {
    requirement: "Skill",
    tier: "must-have",
    weight: 50,
    matched: true,
    evidence: null,
    resumeSnippet: null,
    children: [],
    ...overrides,
  };
}

describe("countByTier", () => {
  it("counts top-level nodes plus nested children, matched vs total, per tier", () => {
    const nodes = [
      node({ requirement: "Python", tier: "must-have", matched: true }),
      node({ requirement: "Kubernetes", tier: "must-have", matched: false }),
      node({ requirement: "Git", tier: "nice-to-have", matched: true }),
      node({
        requirement: "Container system",
        tier: "must-have",
        matched: true,
        children: [node({ requirement: "Docker", tier: "implied", matched: true })],
      }),
    ];
    const counts = countByTier(nodes);
    expect(counts["must-have"]).toEqual({ matched: 2, total: 3 });
    expect(counts["nice-to-have"]).toEqual({ matched: 1, total: 1 });
    // implied only ever appears nested, so it must still be counted.
    expect(counts.implied).toEqual({ matched: 1, total: 1 });
  });

  it("returns all-zero counts for an empty tree", () => {
    const counts = countByTier([]);
    expect(counts["must-have"]).toEqual({ matched: 0, total: 0 });
  });
});

describe("normalizeWeights", () => {
  it("rescales sibling weights to sum to 100 and sorts descending", () => {
    const nodes = [
      node({ requirement: "Git", weight: 10 }),
      node({ requirement: "Python", weight: 40 }),
      node({ requirement: "Kubernetes", weight: 20 }),
    ];
    const result = normalizeWeights(nodes);
    const total = result.reduce((sum, n) => sum + n.weight, 0);
    expect(total).toBeCloseTo(100, 5);
    expect(result.map((n) => n.requirement)).toEqual(["Python", "Kubernetes", "Git"]);
  });

  it("splits evenly when every weight is zero or negative", () => {
    const nodes = [node({ requirement: "A", weight: 0 }), node({ requirement: "B", weight: -5 })];
    const result = normalizeWeights(nodes);
    expect(result[0].weight).toBeCloseTo(50, 5);
    expect(result[1].weight).toBeCloseTo(50, 5);
  });

  it("recursively normalizes and sorts children", () => {
    const nodes = [
      node({
        requirement: "Container system",
        weight: 100,
        children: [
          node({ requirement: "Docker", weight: 10 }),
          node({ requirement: "Kubernetes", weight: 30 }),
        ],
      }),
    ];
    const result = normalizeWeights(nodes);
    const children = result[0].children;
    expect(children.map((n) => n.requirement)).toEqual(["Kubernetes", "Docker"]);
    expect(children[0].weight + children[1].weight).toBeCloseTo(100, 5);
  });

  it("returns an empty array unchanged", () => {
    expect(normalizeWeights([])).toEqual([]);
  });
});
