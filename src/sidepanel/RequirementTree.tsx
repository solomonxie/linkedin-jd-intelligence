import { useState } from "react";
import { normalizeWeights } from "../shared/matchFacts";
import type { RequirementNode, RequirementTier } from "../shared/types";

const TIER_SHORT_LABELS: Record<RequirementTier, string> = {
  "must-have": "required",
  "nice-to-have": "nice",
  implied: "implied",
};

export function RequirementTree({
  nodes,
  prevalenceTooltip,
  defaultExpanded = false,
}: {
  nodes: RequirementNode[];
  /** Tooltip text for a top-level skill's "ⓘ" icon, or null to omit it. */
  prevalenceTooltip: (skill: string) => string | null;
  /** Starts every row expanded — used by the print view, which has no interaction to expand rows with. */
  defaultExpanded?: boolean;
}) {
  const normalized = normalizeWeights(nodes);
  return (
    <ul className="requirement-tree">
      {normalized.map((node) => (
        <RequirementRow key={node.requirement} node={node} depth={0} prevalenceTooltip={prevalenceTooltip} defaultExpanded={defaultExpanded} />
      ))}
    </ul>
  );
}

function RequirementRow({
  node,
  depth,
  prevalenceTooltip,
  defaultExpanded,
}: {
  node: RequirementNode;
  depth: number;
  prevalenceTooltip: (skill: string) => string | null;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;
  // Children are already normalized+sorted recursively by normalizeWeights
  // in the parent call, so nested rows render node.children as-is.
  const tooltip = depth === 0 ? prevalenceTooltip(node.requirement) : null;

  return (
    <li style={{ marginLeft: depth * 16 }}>
      <span className="requirement-row">
        {hasChildren ? (
          <button
            type="button"
            className="expand-toggle"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="expand-spacer" />
        )}
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
      {expanded && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <RequirementRow
              key={child.requirement}
              node={child}
              depth={depth + 1}
              prevalenceTooltip={prevalenceTooltip}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
