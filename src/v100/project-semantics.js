/* Phase-3 surfaces: the semantic tree, provenance, mapping review and state.
 *
 * The job of this file is legibility. Every surface shows the evidence that
 * produced what it says: a tree node shows its level as text and not only as
 * indentation, a provenance row names the registry it came from, a mapping
 * candidate lists its reasons, and a state badge carries a shape and a word as
 * well as a colour. A surface that cannot explain itself has to be trusted, and
 * removing blind trust is the whole point of the phase.
 */
import { statusColourStyles } from "./status-colours.mjs";
import { defineElement } from "./element-registry.mjs";
import { SEMANTIC_LEVELS, semanticPath } from "./semantic-model.mjs";
import { stateProjection } from "./equipment-state.mjs";

const STYLE = `${statusColourStyles()}
  .glt-sem-tree{margin:0;padding:0;list-style:none;font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif}
  .glt-sem-node{display:flex;align-items:center;gap:8px;min-height:44px;padding:4px 8px;border-radius:8px}
  .glt-sem-level{font:700 12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--glt-muted,#5f7288);text-transform:uppercase;letter-spacing:.06em}
  .glt-sem-invalid{color:var(--glt-error,#b3261e);font-weight:700}
  .glt-sem-path{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--glt-muted,#5f7288);overflow-wrap:anywhere}
  .glt-sem-row{display:flex;gap:8px;align-items:baseline;padding:4px 0}
  .glt-sem-source{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--glt-muted,#5f7288)}
  .glt-sem-badge{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:4px 12px;border:1px solid currentColor;border-radius:999px;font:700 12px/1.4 inherit}
  .glt-sem-badge[data-tone="critical"]{color:var(--glt-error,#b3261e)}.glt-sem-badge[data-tone="caution"]{color:var(--glt-warning,#8a5200)}
  .glt-sem-badge[data-tone="positive"]{color:var(--glt-success,#0b6b38)}.glt-sem-badge[data-tone="info"]{color:var(--glt-info,#0f6d99)}
  .glt-sem-badge[data-tone="neutral"]{color:var(--glt-muted,#5f7288)}
  .glt-sem-reasons{margin:4px 0 0;padding-left:20px;font:12px/1.4 inherit}
  .glt-sem-weak{font-style:italic}
  @media(forced-colors:active){.glt-sem-badge{border:1px solid CanvasText}}
`;

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

/** Shared plumbing: one `props` assignment in, one repaint out. */
class GltSemanticElement extends HTMLElement {
  constructor() {
    super();
    this._copy = (key) => key;
    this._props = {};
  }

  connectedCallback() {
    this.paint();
  }

  set copy(value) {
    if (typeof value !== "function") return;
    this._copy = value;
    this.paint();
  }

  set props(value) {
    this._props = value ?? {};
    this.paint();
  }

  get props() {
    return this._props;
  }

  paint() {
    if (this.isConnected) this.replaceChildren(...this.render());
  }

  render() {
    return [];
  }
}

/**
 * The containment tree.
 *
 * The level is rendered as text as well as by indentation: indentation alone is
 * invisible to a screen reader and to anyone scrolling a deep tree.
 */
class GltSemanticTree extends GltSemanticElement {
  render() {
    const { model, invalidNodes = [] } = this._props;
    const nodes = Array.isArray(model?.nodes) ? model.nodes : [];
    if (nodes.length === 0) return [element("p", "glt-sem-path", this._copy("semanticEmpty"))];

    const invalid = new Set(invalidNodes);
    const list = element("ul", "glt-sem-tree");
    list.setAttribute("role", "tree");
    for (const node of nodes) {
      const item = element("li");
      item.setAttribute("role", "treeitem");
      const depth = Math.max(1, SEMANTIC_LEVELS.indexOf(node.level) + 1);
      item.setAttribute("aria-level", String(depth));
      const row = element("div", "glt-sem-node");
      row.style.paddingLeft = `${8 + depth * 12}px`;
      row.append(element("span", "glt-sem-level", node.level ?? "?"));
      row.append(element("span", "", node.name ?? node.id));
      if (invalid.has(node.id)) {
        // An invalid node is shown with its contract path rather than hidden:
        // a node that vanishes is a node nobody repairs.
        row.append(element("span", "glt-sem-invalid", this._copy("semanticInvalidNode")));
      }
      item.append(row);
      const path = semanticPath(model, node.id);
      if (path.length > 0) item.append(element("div", "glt-sem-path", path.join(" / ")));
      list.append(item);
    }
    for (const [index, item] of [...list.children].entries()) {
      item.setAttribute("aria-posinset", String(index + 1));
      item.setAttribute("aria-setsize", String(list.children.length));
    }
    return [list];
  }
}

/** Where a value comes from, with the registry that said so on every row. */
class GltProvenanceCard extends GltSemanticElement {
  render() {
    const record = this._props.record;
    if (!record) return [];
    const section = element("section");
    section.append(element("h4", "", this._copy("provenanceHeading")));

    for (const field of ["integration", "config_entry", "device", "area", "health"]) {
      const value = record[field];
      if (!value || !value.source) continue;  // a row with no source is not rendered
      const row = element("div", "glt-sem-row");
      row.append(element("span", "", this._copy(`provenance_${field}`)));
      const detail = field === "integration"
        ? (value.label ?? value.domain ?? this._copy("unknown"))
        : (value.value ?? value.title ?? value.name ?? value.manufacturer ?? this._copy("unknown"));
      row.append(element("strong", "", detail));
      row.append(element("span", "glt-sem-source", value.source));
      if (field === "integration" && value.known === false) {
        row.append(element("span", "glt-sem-weak", this._copy("provenanceUnknownIntegration")));
      }
      section.append(row);
    }
    return [section];
  }
}

/** Ranked candidates with their reasons always visible. */
class GltMappingReview extends GltSemanticElement {
  render() {
    const { candidates = [], onAccept } = this._props;
    if (candidates.length === 0) return [element("p", "glt-sem-path", this._copy("mappingEmpty"))];
    const list = element("ol");
    for (const candidate of candidates) {
      const item = element("li");
      item.append(element("strong", "", candidate.entity_id));
      item.append(element("span", "glt-sem-source", ` ${candidate.score}`));
      if (candidate.override) item.append(element("span", "", this._copy("mappingOverride")));
      if (candidate.sufficient === false) {
        // A candidate resting only on a name says so, rather than leaving a
        // reader to notice.
        item.append(element("span", "glt-sem-weak", this._copy("mappingWeakEvidence")));
      }
      const reasons = element("ul", "glt-sem-reasons");
      for (const reason of candidate.reasons ?? []) {
        reasons.append(element("li", "", `${reason.code} ${reason.weight}`));
      }
      item.append(reasons);
      list.append(item);
    }
    const accept = element("button", "", this._copy("mappingAccept"));
    accept.type = "button";
    accept.addEventListener("click", () => onAccept?.());
    return [list, accept];
  }
}

/** One resolved state, with a shape and a word as well as a colour. */
class GltStateBadge extends GltSemanticElement {
  render() {
    const { resolved, locale = "en" } = this._props;
    if (!resolved) return [];
    const projection = stateProjection(resolved, locale);
    const badge = element("span", "glt-sem-badge");
    badge.dataset.tone = projection.tone;
    badge.dataset.stateSymbol = projection.symbol;
    const glyph = element("span", "", projection.symbol);
    glyph.setAttribute("aria-hidden", "true");
    badge.append(glyph, element("span", "", projection.label));
    for (const mode of projection.modes) {
      badge.append(element("span", "", `· ${mode}`));
    }
    return [badge];
  }
}

if (typeof document !== "undefined" && !document.querySelector("style[data-glt-semantics]")) {
  const style = element("style");
  style.dataset.gltSemantics = "1";
  style.textContent = STYLE;
  document.head?.append(style);
}

for (const [name, constructor] of [
  ["glt-flow-card-semantic-tree", GltSemanticTree],
  ["glt-flow-card-provenance-card", GltProvenanceCard],
  ["glt-flow-card-mapping-review", GltMappingReview],
  ["glt-flow-card-state-badge", GltStateBadge],
]) {
  defineElement(name, constructor);
}
