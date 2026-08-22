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
const SECTION_LABELS: Record<RequirementTier, string> = {
  "must-have": "Required",
  "nice-to-have": "Preferred",
  implied: "Implied skills",
};

/** Shown in place of RequirementTree while a first-time analysis is still running, so the panel's
 * shape (both tier sections) is visible immediately instead of an empty gap. */
export function RequirementTreeSkeleton() {
  return (
    <>
      {TOP_LEVEL_TIERS.map((tier) => (
        <section className="requirement-tier-section" key={tier}>
          <h4 className="tier-section-heading">{SECTION_LABELS[tier]}</h4>
          <ul className="requirement-tree">
            <li className="skeleton-row">Analyzing…</li>
          </ul>
        </section>
      ))}
    </>
  );
}

export function RequirementTree({
  nodes,
  prevalenceTooltip,
}: {
  nodes: RequirementNode[];
  /** Tooltip text for a top-level skill's "ⓘ" icon, or null to omit it. */
  prevalenceTooltip: (skill: string) => string | null;
}) {
  return (
    <>
      {TOP_LEVEL_TIERS.map((tier) => {
        const group = normalizeWeights(nodes.filter((n) => n.tier === tier));
        if (group.length === 0) return null;
        return (
          <section className="requirement-tier-section" key={tier}>
            <h4 className="tier-section-heading">{SECTION_LABELS[tier]}</h4>
            <ul className="requirement-tree">
              {group.map((node) => (
                <RequirementRow key={node.requirement} node={node} depth={0} prevalenceTooltip={prevalenceTooltip} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function RequirementRow({
  node,
  depth,
  prevalenceTooltip,
}: {
  node: RequirementNode;
  depth: number;
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
        <span className="tier-badge" data-tier={node.tier}>
          {TIER_SHORT_LABELS[node.tier]}
        </span>
      </span>
      {hasChildren && (
        <ul>
          {node.children.map((child) => (
            <RequirementRow key={child.requirement} node={child} depth={depth + 1} prevalenceTooltip={prevalenceTooltip} />
          ))}
        </ul>
      )}
    </li>
  );
}
