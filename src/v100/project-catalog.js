/* Phase-5 catalog surfaces: the symbol browser and the port inspector.
 *
 * Two rules from the UI contract run through both, and neither is decoration.
 *
 * Every variant carries **words**. A grid of pictures with no text is unusable
 * by search, unreadable by a screen reader, and indistinguishable from an empty
 * grid in forced colours. The label, the style and the category are text.
 *
 * A refusal is **explained**. Phase 2's denials are opaque because the caller
 * must not learn what exists; an engineering refusal is the opposite, because
 * the engineer has the diagram open in front of them and withholding the reason
 * only costs them the afternoon they spend guessing. A red outline alone, or a
 * silent no-op, is the version of this feature that does not work.
 */
import {
  BASE_SYMBOLS, DOMAINS, SYMBOL_VARIANTS, VISUAL_STYLES,
  domainForCategory, renderVariant,
} from "./catalog.mjs";
import { symbolCatalogStats } from "./core.mjs";
import { PORT_KINDS, REFUSAL_REASONS } from "./ports.mjs";

const STYLE = `
  .glt-cat{font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;display:block;max-width:100%}
  .glt-cat,.glt-cat *{min-width:0;overflow-wrap:anywhere}
  .glt-cat-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;padding:4px 0}
  .glt-cat-count{font:700 12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;border:1px solid currentColor;border-radius:999px;padding:2px 8px}
  .glt-cat-filters{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0}
  .glt-cat-filters label{display:inline-flex;flex-direction:column;gap:2px;font:12px/1.4 inherit}
  .glt-cat-filters select,.glt-cat-filters input{min-height:44px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;padding:0 8px}
  .glt-cat-grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin:0;padding:0;list-style:none}
  .glt-cat-card{display:grid;gap:4px;padding:8px;border:1px solid currentColor;border-radius:8px}
  .glt-cat-card svg{width:48px;height:48px}
  .glt-cat-name{font-weight:700}
  .glt-cat-meta{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--mut,#8198ad)}
  .glt-cat-empty{color:var(--mut,#8198ad);font-style:italic;padding:8px 0}
  .glt-cat-port{display:grid;gap:4px;padding:8px;border:1px solid currentColor;border-radius:8px}
  .glt-cat-row{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}
  .glt-cat-glyph{font:700 14px/1 ui-monospace,SFMono-Regular,Consolas,monospace}
  .glt-cat-refusal{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;min-height:44px;padding:4px 12px;border:1px solid currentColor;border-radius:8px;font-weight:700;color:#ff4f4f}
  .glt-cat :focus-visible{outline:2px solid currentColor;outline-offset:2px}
  @media(forced-colors:active){
    .glt-cat-card,.glt-cat-port,.glt-cat-refusal,.glt-cat-count{border:1px solid CanvasText}
  }
`;

/** DE/EN copy. A missing key renders its own name, never the other language. */
const COPY = {
  en: {
    catalog_title: "Symbol catalog",
    published_variants: "published variants",
    filter_category: "Category",
    filter_domain: "Domain",
    filter_style: "Style",
    filter_text: "Search",
    filter_all: "All",
    no_matches: "No symbol matches these filters",
    port_medium: "Medium",
    port_direction: "Direction",
    port_kind: "Kind",
    port_multiplicity: "Connections",
    port_side: "Side",
    direction_in: "Inlet",
    direction_out: "Outlet",
    direction_bidirectional: "Both ways",
    kind_process: "Process",
    kind_signal: "Signal",
    kind_power: "Power",
    multiplicity_one: "One connection",
    multiplicity_many: "Many connections",
    multiplicity_full: "At its limit",
    refusal_title: "This connection is not possible",
    refusal_medium_mismatch: "The media differ: these two ports carry different things.",
    refusal_direction_conflict: "The directions conflict: both ports point the same way.",
    refusal_kind_mismatch: "The kinds differ: a process port cannot join a signal or power port.",
    refusal_multiplicity_exceeded: "That port already has the one connection it admits.",
    refusal_self_connection: "A port cannot be connected to itself.",
    refusal_duplicate_connection: "These two ports are already connected.",
    refusal_unknown: "The connection was refused.",
  },
  de: {
    catalog_title: "Symbolkatalog",
    published_variants: "veröffentlichte Varianten",
    filter_category: "Kategorie",
    filter_domain: "Gewerk",
    filter_style: "Stil",
    filter_text: "Suche",
    filter_all: "Alle",
    no_matches: "Kein Symbol passt zu diesen Filtern",
    port_medium: "Medium",
    port_direction: "Richtung",
    port_kind: "Art",
    port_multiplicity: "Verbindungen",
    port_side: "Seite",
    direction_in: "Eingang",
    direction_out: "Ausgang",
    direction_bidirectional: "Beide Richtungen",
    kind_process: "Prozess",
    kind_signal: "Signal",
    kind_power: "Energie",
    multiplicity_one: "Eine Verbindung",
    multiplicity_many: "Mehrere Verbindungen",
    multiplicity_full: "Bereits belegt",
    refusal_title: "Diese Verbindung ist nicht möglich",
    refusal_medium_mismatch: "Die Medien unterscheiden sich: die Ports führen Verschiedenes.",
    refusal_direction_conflict: "Die Richtungen widersprechen sich: beide Ports zeigen gleich.",
    refusal_kind_mismatch: "Die Arten unterscheiden sich: Prozess passt nicht zu Signal oder Energie.",
    refusal_multiplicity_exceeded: "Dieser Port hat die eine Verbindung bereits, die er zulässt.",
    refusal_self_connection: "Ein Port kann nicht mit sich selbst verbunden werden.",
    refusal_duplicate_connection: "Diese beiden Ports sind bereits verbunden.",
    refusal_unknown: "Die Verbindung wurde abgelehnt.",
  },
};

// Both languages must carry the same keys, or one of them renders key names in
// production. Checked at module load rather than left to a translator's memory.
{
  const en = Object.keys(COPY.en).sort().join(",");
  const de = Object.keys(COPY.de).sort().join(",");
  if (en !== de) throw new Error("project-catalog copy keys differ between de and en");
}

// Every refusal the port model can produce needs words. A reason with no copy
// would render as a code, which is the "red outline alone" failure by another
// route.
for (const reason of REFUSAL_REASONS) {
  if (!(`refusal_${reason}` in COPY.en)) {
    throw new Error(`project-catalog has no wording for refusal ${reason}`);
  }
}

export const PROJECT_CATALOG_COPY = COPY;

function textFor(language, key) {
  const table = COPY[language] ?? COPY.en;
  return table[key] ?? COPY.en[key] ?? key;
}

/**
 * Turn generated symbol markup into nodes without `innerHTML`.
 *
 * The markup is first-party -- it comes from `renderVariant`, over geometry
 * held as data in this repository -- so this is not a sanitising step. It is a
 * habit: nothing in the card assigns a string to `innerHTML`, so the browser
 * effect ledger's "zero script insertions" assertion has no exception to carve
 * out and no future contributor has an example to copy.
 */
function parseSymbol(markup) {
  if (typeof DOMParser === "undefined") return null;
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = parsed.documentElement;
  if (!root || root.nodeName === "parsererror") return null;
  return document.importNode(root, true);
}

/**
 * The published count, computed once.
 *
 * It comes from `symbolCatalogStats()`, which counts variants that actually
 * rendered -- the same computation `catalog-evidence.json` records, and the
 * Node suite requires the two to be the same number. Computing it once is not
 * an optimisation: recomputing it per keystroke would make a filter change
 * re-render the whole catalog to answer a question whose answer never changes.
 */
const PUBLISHED = symbolCatalogStats();

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

class GltCatalogElement extends HTMLElement {
  constructor() {
    super();
    this._props = {};
  }

  set props(value) {
    this._props = value ?? {};
    this.render();
  }

  get props() {
    return this._props;
  }

  get language() {
    return this._props.language === "de" ? "de" : "en";
  }

  connectedCallback() {
    this.classList.add("glt-cat");
    this.render();
  }

  render() {
    this.textContent = "";
  }
}

/**
 * The symbol browser.
 *
 * The count comes from `symbolCatalogStats()`, which counts variants that
 * actually rendered — the same computation `catalog-evidence.json` records, and
 * the Node suite requires the two to be the same number. It is not an array
 * length, and it is not a literal copied out of the documentation.
 */
class GltSymbolBrowser extends GltCatalogElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const stats = PUBLISHED;

    const head = element("div", "glt-cat-head");
    head.append(element("h3", "glt-cat-name", textFor(language, "catalog_title")));
    const count = element("span", "glt-cat-count", String(stats.variants));
    count.dataset.publishedCount = String(stats.variants);
    head.append(count, element("span", "glt-cat-meta", textFor(language, "published_variants")));
    this.append(head);

    const filters = this._props.filters ?? {};
    this.append(this._filters(language, filters));

    const matching = SYMBOL_VARIANTS.filter((variant) => {
      const base = BASE_SYMBOLS.find((entry) => entry.id === variant.base_symbol);
      if (filters.category && variant.category !== filters.category) return false;
      if (filters.domain && domainForCategory(variant.category) !== filters.domain) return false;
      if (filters.style && variant.style !== filters.style) return false;
      if (filters.text) {
        const haystack = `${variant.label} ${variant.category} ${base?.id ?? ""}`.toLowerCase();
        if (!haystack.includes(String(filters.text).toLowerCase())) return false;
      }
      return true;
    });

    if (matching.length === 0) {
      // Saying so, rather than rendering an empty grid: an empty grid is
      // indistinguishable from a catalog that failed to load.
      this.append(element("p", "glt-cat-empty", textFor(language, "no_matches")));
      return;
    }

    const grid = element("ul", "glt-cat-grid");
    for (const variant of matching) {
      const base = BASE_SYMBOLS.find((entry) => entry.id === variant.base_symbol);
      const style = VISUAL_STYLES.find((entry) => entry.id === variant.style);
      const card = element("li", "glt-cat-card");
      card.dataset.variant = variant.id;
      card.dataset.baseSymbol = variant.base_symbol;
      card.dataset.style = variant.style;

      const drawing = element("div");
      drawing.setAttribute("aria-hidden", "true");
      const svg = parseSymbol(renderVariant(variant.base_symbol, variant.style));
      if (svg) drawing.append(svg);
      card.append(drawing);

      const button = element("button", "glt-cat-name", base?.label ?? variant.base_symbol);
      button.type = "button";
      button.dataset.chooseVariant = variant.id;
      button.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("glt-symbol-chosen", {
          detail: { variant: variant.id, base: variant.base_symbol, style: variant.style },
          bubbles: true,
          composed: true,
        }));
      });
      card.append(button);
      card.append(element("span", "glt-cat-meta", `${variant.category} · ${style?.label ?? variant.style}`));
      grid.append(card);
    }
    this.append(grid);
  }

  _filters(language, active) {
    const wrap = element("div", "glt-cat-filters");
    const categories = [...new Set(BASE_SYMBOLS.map((base) => base.category))].sort();
    const choices = [
      ["category", "filter_category", categories.map((value) => [value, value])],
      ["domain", "filter_domain", DOMAINS.map((domain) => [domain.id, domain.label[language]])],
      ["style", "filter_style", VISUAL_STYLES.map((style) => [style.id, style.label])],
    ];
    for (const [name, labelKey, options] of choices) {
      const label = element("label");
      label.append(element("span", null, textFor(language, labelKey)));
      const select = element("select");
      select.dataset.filter = name;
      const all = element("option", null, textFor(language, "filter_all"));
      all.value = "";
      select.append(all);
      for (const [value, text] of options) {
        const option = element("option", null, text);
        option.value = value;
        if (active[name] === value) option.selected = true;
        select.append(option);
      }
      select.addEventListener("change", () => this._filterChanged(name, select.value));
      label.append(select);
      wrap.append(label);
    }
    const search = element("label");
    search.append(element("span", null, textFor(language, "filter_text")));
    const input = element("input");
    input.type = "search";
    input.dataset.filter = "text";
    input.value = active.text ?? "";
    input.addEventListener("input", () => this._filterChanged("text", input.value));
    search.append(input);
    wrap.append(search);
    return wrap;
  }

  _filterChanged(name, value) {
    this.props = {
      ...this._props,
      filters: { ...(this._props.filters ?? {}), [name]: value },
    };
  }
}

/** Direction and kind as shapes, so two ports differ without colour. */
const DIRECTION_GLYPH = { in: "→|", out: "|→", bidirectional: "↔" };
const KIND_GLYPH = { process: "◇", signal: "∿", power: "⚡" };

/**
 * The port inspector, and the place a refused connection is explained.
 *
 * The refusal is rendered from the reason code the port model returned, which
 * is why that model's codes are a closed set: a code with no wording here would
 * reach an engineer as a code.
 */
class GltPortInspector extends GltCatalogElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const { port, refusal } = this._props;

    if (port) {
      const block = element("div", "glt-cat-port");
      block.dataset.portId = port.id ?? "";
      for (const [key, value, glyph] of [
        ["port_medium", port.medium ?? "—", null],
        ["port_direction", textFor(language, `direction_${port.direction}`), DIRECTION_GLYPH[port.direction]],
        ["port_kind", textFor(language, `kind_${port.kind}`), KIND_GLYPH[port.kind]],
        ["port_multiplicity", textFor(language, `multiplicity_${port.multiplicity}`), null],
        ["port_side", port.side ?? "—", null],
      ]) {
        const row = element("div", "glt-cat-row");
        row.append(element("span", "glt-cat-meta", textFor(language, key)));
        if (glyph) {
          const mark = element("span", "glt-cat-glyph", glyph);
          mark.setAttribute("aria-hidden", "true");
          row.append(mark);
        }
        row.append(element("strong", null, value));
        block.append(row);
      }
      if (port.multiplicity === "one" && Number(this._props.connections ?? 0) >= 1) {
        block.append(element("p", "glt-cat-meta", textFor(language, "multiplicity_full")));
      }
      this.append(block);
    }

    if (refusal && refusal.compatible === false) {
      const strip = element("div", "glt-cat-refusal");
      strip.setAttribute("role", "status");
      strip.dataset.refusalReason = refusal.reason ?? "unknown";
      const mark = element("span", "glt-cat-glyph", "✕");
      mark.setAttribute("aria-hidden", "true");
      strip.append(mark);
      strip.append(element("strong", null, textFor(language, "refusal_title")));
      const key = REFUSAL_REASONS.includes(refusal.reason)
        ? `refusal_${refusal.reason}`
        : "refusal_unknown";
      strip.append(element("span", null, textFor(language, key)));
      if (refusal.detail) {
        const detail = Object.entries(refusal.detail)
          .map(([name, value]) => `${name}: ${value}`).join(" · ");
        if (detail) strip.append(element("span", "glt-cat-meta", detail));
      }
      this.append(strip);
    }
  }
}

export const PORT_GLYPHS = Object.freeze({
  direction: Object.freeze({ ...DIRECTION_GLYPH }),
  kind: Object.freeze(Object.fromEntries(PORT_KINDS.map((kind) => [kind, KIND_GLYPH[kind]]))),
});

if (typeof document !== "undefined" && !document.querySelector("style[data-glt-catalog]")) {
  const style = element("style");
  style.dataset.gltCatalog = "1";
  style.textContent = STYLE;
  document.head?.append(style);
}

for (const [name, constructor] of [
  ["glt-flow-card-symbol-browser", GltSymbolBrowser],
  ["glt-flow-card-port-inspector", GltPortInspector],
]) {
  if (!customElements.get(name)) customElements.define(name, constructor);
}
