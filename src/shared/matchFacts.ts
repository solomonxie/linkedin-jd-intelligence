// Pure, local derivations from a requirement tree — never trust the LLM's own
// arithmetic. See docs/DESIGN.md "Requirement tree, weight, and implication".

import type { RequirementNode, RequirementTier } from "./types";

export interface TierCounts {
  matched: number;
  total: number;
}

export type TierCountsByTier = Record<RequirementTier, TierCounts>;

/**
 * Headline "n/m" figures per tier, counting every node in the tree regardless
 * of depth. "implied" nodes are exclusively nested children by construction
 * (see promptBuilder's REQUIREMENT TREE section) — they never appear at the
 * top level, so a top-level-only count always read 0/0 for that tier.
 */
export function countByTier(nodes: RequirementNode[]): TierCountsByTier {
  const counts: TierCountsByTier = {
    "must-have": { matched: 0, total: 0 },
    "nice-to-have": { matched: 0, total: 0 },
    implied: { matched: 0, total: 0 },
  };
  for (const node of nodes) {
    counts[node.tier].total += 1;
    if (node.matched) counts[node.tier].matched += 1;
    const childCounts = countByTier(node.children);
    for (const tier of Object.keys(counts) as RequirementTier[]) {
      counts[tier].total += childCounts[tier].total;
      counts[tier].matched += childCounts[tier].matched;
    }
  }
  return counts;
}

/**
 * Returns a copy of the tree with `weight` rescaled so each sibling group sums
 * to 100 (the model's raw weights are a rough relative signal, not trusted
 * arithmetic), sorted within each sibling group by that renormalized weight,
 * descending. Applied recursively to `children`. Negative/zero weights are
 * treated as 0; an all-zero group is split evenly rather than left at 0/0.
 */
export function normalizeWeights(nodes: RequirementNode[]): RequirementNode[] {
  if (nodes.length === 0) return [];
  const total = nodes.reduce((sum, n) => sum + Math.max(n.weight, 0), 0);
  return nodes
    .map((node) => ({
      ...node,
      weight: total > 0 ? (Math.max(node.weight, 0) / total) * 100 : 100 / nodes.length,
      children: normalizeWeights(node.children),
    }))
    .sort((a, b) => b.weight - a.weight);
}
