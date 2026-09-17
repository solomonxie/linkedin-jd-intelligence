import { normalizeWeights } from "../shared/matchFacts";
import type { RequirementNode, RequirementTier } from "../shared/types";

const TIER_SHORT_LABELS: Record<RequirementTier, string> = {
  "must-have": "required",
  "nice-to-have": "preferred",
  implied: "implied",
};

// Implied nodes are exclusively nested children by construction (see
// matchFacts.ts) — only these two tiers ever appear at the top level.
const TOP_LEVEL_TIERS: RequirementTier[] = ["must-have", "nice-to-have"];

/** Shown in place of RequirementTree before there's a tree to show, so the panel's shape is visible
 * immediately instead of an empty gap. `label` says which wait it is — reading the page, or the
 * analysis itself. */
export function RequirementTreeSkeleton({ label = "Analyzing…" }: { label?: string }) {
  return (
    <ul className="requirement-tree">
      <li className="skeleton-row">{label}</li>
    </ul>
  );
}

/** Top-level nodes that came out of the same posting line, kept in tree order. A node with no
 * sourceText (older record, or a node the model couldn't trace to one line) forms its own
 * headerless group, and carries its tier badge on the node row instead. */
interface SourceGroup {
  sourceText: string | null;
  /** Shared by every node in the group — grouping only ever happens within one tier. */
  tier: RequirementTier;
  nodes: RequirementNode[];
}

export function groupBySourceText(nodes: RequirementNode[]): SourceGroup[] {
  const groups: SourceGroup[] = [];
  for (const node of nodes) {
    const sourceText = node.sourceText?.trim() || null;
    const existing = sourceText === null ? undefined : groups.find((g) => g.sourceText === sourceText);
    if (existing) existing.nodes.push(node);
    else groups.push({ sourceText, tier: node.tier, nodes: [node] });
  }
  return groups;
}

export function RequirementTree({
  nodes,
  prevalenceTooltip,
}: {
  nodes: RequirementNode[];
  /** Tooltip text for a top-level skill's "ⓘ" icon, or null to omit it. */
  prevalenceTooltip: (skill: string) => string | null;
}) {
  // One list, no per-tier headings — each group's badge already says which tier it is. Weights are
  // still normalized per tier (so they sum to 100 within required and within preferred), and required
  // groups still come first; only the section split is gone.
  const groups = TOP_LEVEL_TIERS.flatMap((tier) => groupBySourceText(normalizeWeights(nodes.filter((n) => n.tier === tier))));
  if (groups.length === 0) return null;

  return (
    <ul className="requirement-tree">
      {groups.map((group, index) => (
        <li className="requirement-source-group" key={group.sourceText ?? `${group.nodes[0].requirement}-${index}`}>
          {group.sourceText && (
            <p className="requirement-source">
              <span>{group.sourceText}</span>
              <span className="tier-badge" data-tier={group.tier}>
                {TIER_SHORT_LABELS[group.tier]}
              </span>
            </p>
          )}
          <ul>
            {group.nodes.map((node) => (
              <RequirementRow
                key={node.requirement}
                node={node}
                depth={0}
                groupTier={group.sourceText ? group.tier : null}
                prevalenceTooltip={prevalenceTooltip}
              />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function RequirementRow({
  node,
  depth,
  groupTier,
  prevalenceTooltip,
}: {
  node: RequirementNode;
  depth: number;
  /** The tier already shown on the group's quoted line, or null when there's no quoted line to carry
   * it. A row only repeats the badge when it differs — i.e. an "implied" child, which is the one case
   * where the tier is genuinely new information rather than the same word on every row. */
  groupTier: RequirementTier | null;
  prevalenceTooltip: (skill: string) => string | null;
}) {
  const hasChildren = node.children.length > 0;
  // Children are already normalized+sorted recursively by normalizeWeights
  // in the parent call, so nested rows render node.children as-is. Always
  // shown, nested by indentation — no collapse toggle to hide them behind.
  const tooltip = depth === 0 ? prevalenceTooltip(node.requirement) : null;

  return (
    <li style={{ marginLeft: depth * 16 }}>
      <span className="requirement-row">
        <span className={`check-icon ${node.matched ? "matched" : "unmatched"}`}>{node.matched ? "✓" : "✕"}</span>
        <span>
          {node.requirement} ({Math.round(node.weight)}%)
        </span>
        {tooltip && (
          <span className="info-icon" data-tooltip={tooltip} aria-label={tooltip} tabIndex={0}>
            ⓘ
          </span>
        )}
        {node.tier !== groupTier && (
          <span className="tier-badge" data-tier={node.tier}>
            {TIER_SHORT_LABELS[node.tier]}
          </span>
        )}
      </span>
      {hasChildren && (
        <ul>
          {node.children.map((child) => (
            <RequirementRow
              key={child.requirement}
              node={child}
              depth={depth + 1}
              groupTier={groupTier}
              prevalenceTooltip={prevalenceTooltip}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
