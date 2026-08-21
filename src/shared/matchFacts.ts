// Pure, local derivations from a requirement tree — never trust the LLM's own
// arithmetic. See docs/DESIGN.md "Requirement tree, weight, and implication".

import type { RequirementNode, RequirementTier } from "./types";

export interface TierCounts {
  matched: number;
  total: number;
}

export type TierCountsByTier = Record<RequirementTier, TierCounts>;

/**
 * Headline "n/m" figures per tier, counting **top-level nodes only** — children
 * are informational detail and must not double-count into the primary ratio.
 */
export function countByTier(topLevelNodes: RequirementNode[]): TierCountsByTier {
  const counts: TierCountsByTier = {
    "must-have": { matched: 0, total: 0 },
    "nice-to-have": { matched: 0, total: 0 },
    implied: { matched: 0, total: 0 },
  };
  for (const node of topLevelNodes) {
    counts[node.tier].total += 1;
    if (node.matched) counts[node.tier].matched += 1;
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
