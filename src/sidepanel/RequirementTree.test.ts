import { describe, expect, it } from "vitest";
import { groupBySourceText } from "./RequirementTree";
import type { RequirementNode } from "../shared/types";

function node(requirement: string, sourceText?: string | null): RequirementNode {
  return {
    requirement,
    tier: "must-have",
    weight: 10,
    matched: true,
    sourceText,
    evidence: null,
    resumeSnippet: null,
    children: [],
  };
}

describe("groupBySourceText", () => {
  it("puts every node from the same posting line under one group", () => {
    const line = "Strong proficiency in Python, Go, or C++";
    const groups = groupBySourceText([node("Python", line), node("Go", line), node("C++", line)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].sourceText).toBe(line);
    expect(groups[0].nodes.map((n) => n.requirement)).toEqual(["Python", "Go", "C++"]);
  });

  it("groups by line even when the same line's nodes aren't adjacent", () => {
    const groups = groupBySourceText([node("Python", "line A"), node("Docker", "line B"), node("Go", "line A")]);

    expect(groups.map((g) => g.sourceText)).toEqual(["line A", "line B"]);
    expect(groups[0].nodes.map((n) => n.requirement)).toEqual(["Python", "Go"]);
  });

  it("gives every untraceable node its own headerless group", () => {
    // Two nodes with no source line are two separate requirements, not one shared bullet —
    // merging them on a null key would render them as if the posting said them together.
    const groups = groupBySourceText([node("Python", null), node("Docker"), node("Go", "   ")]);

    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.sourceText === null)).toBe(true);
  });
});
