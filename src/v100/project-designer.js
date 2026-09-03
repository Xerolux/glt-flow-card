/* Phase-5 designer surfaces: the canvas, the layer panel, the minimap and the
 * extension manager.
 *
 * Three rules run through all four, and each is a requirement rather than a
 * preference.
 *
 * **Nothing here mutates a project.** Every gesture produces a command value
 * and dispatches it; the host applies it through `designer-commands.mjs`, where
 * undo is a proven property rather than a feature. A surface that edited the
 * document directly would put a mutation outside the model that makes undo
 * true, and the undo stack would be wrong in exactly the cases nobody clicked.
 *
 * **Every gesture has a keyboard path.** The kiosk layout Phase 4 established
 * has no pointer at all, so this is not an accessibility footnote: an editor
 * you can only mouse is an editor half the installations cannot use. The
 * shortcuts are declared in one table, rendered as visible help, and asserted
 * as one continuous scenario rather than as per-element focusability.
 *
 * **A destructive step is confirmed through the Phase-2 element**, never
 * `window.confirm`. A native dialog is a browser-owned authority prompt: it
 * cannot be styled, cannot be reached by the kiosk's key handling, and cannot
 * be observed by the effect ledger that proves the card asks for nothing it
 * should not.
 */

import { statusColourStyles } from "./status-colours.mjs";
import { defineElement } from "./element-registry.mjs";
import { hasWording, template as catalogTemplate, text as catalogText } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";

import { COMMAND_KINDS, UNDO_DEPTH_LIMIT, sampleCommand } from "./designer-commands.mjs";
import { checkCompatibility } from "./ports.mjs";
import { projectSafetyCopy } from "./project-safety-i18n.mjs";
import {
  DEFAULT_CLEARANCE, DEFAULT_SPACING, createRouter, relevantObstacles, routeNetwork, routePath,
} from "./routing.mjs";

const STYLE = `${statusColourStyles()}
  .glt-des{font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;display:block;max-width:100%}
  .glt-des,.glt-des *{min-width:0;overflow-wrap:anywhere}
  .glt-des-bar{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0}
  .glt-des-bar button{min-height:44px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;padding:0 12px;cursor:pointer}
  .glt-des-grid{display:grid;gap:4px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin:4px 0;padding:0;list-style:none}
  .glt-des-cell{display:grid;gap:2px;min-height:44px;padding:8px;border:1px solid currentColor;border-radius:8px}
  .glt-des-cell[aria-selected="true"]{outline:2px solid currentColor;outline-offset:2px}
  .glt-des-meta{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--glt-muted,#5f7288)}
  .glt-des-keys{margin:4px 0;padding:0;list-style:none;display:grid;gap:2px}
  .glt-des-key{display:flex;flex-wrap:wrap;gap:8px}
  .glt-des-kbd{font:700 12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;border:1px solid currentColor;border-radius:4px;padding:0 6px}
  .glt-des-live{min-height:44px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:4px 12px;border:1px solid currentColor;border-radius:8px}
  .glt-des-live[data-tone="error"]{color:var(--glt-error,#b3261e)}
  .glt-des-list{margin:0;padding:0;list-style:none;display:grid;gap:4px}
  .glt-des-item{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-height:44px;padding:4px 8px;border:1px solid currentColor;border-radius:8px}
  .glt-des-map{display:block;border:1px solid currentColor;border-radius:8px}
  .glt-des-empty{color:var(--glt-muted,#5f7288);font-style:italic}
  .glt-des :focus-visible{outline:2px solid currentColor;outline-offset:2px}
  @media(forced-colors:active){
    .glt-des-cell,.glt-des-item,.glt-des-live,.glt-des-map,.glt-des-kbd{border:1px solid CanvasText}
  }
`;

/**
 * Every keyboard path the designer offers, in one table.
 *
 * One table rather than a scatter of handlers, because it is also the help
 * text: a shortcut nobody can discover is a shortcut nobody has. The kiosk has
 * no pointer, so every entry here is the *only* way to do the thing it names.
 */
export const DESIGNER_KEYS = Object.freeze([
  { keys: "ArrowKeys", command: "move", coarse: false, label: "nudge_fine" },
  { keys: "Shift+ArrowKeys", command: "move", coarse: true, label: "nudge_coarse" },
  { keys: "Alt+ArrowKeys", command: "resize", coarse: false, label: "resize" },
  { keys: "Insert", command: "add", label: "add" },
  { keys: "Shift+Insert", command: "master_instantiate", label: "instantiate_master" },
  { keys: "Enter", command: "select", label: "select" },
  { keys: "Shift+Enter", command: "extend", label: "extend_selection" },
  { keys: "g", command: "group", label: "group" },
  { keys: "Shift+G", command: "ungroup", label: "ungroup" },
  { keys: "a", command: "align", label: "align" },
  { keys: "d", command: "distribute", label: "distribute" },
  { keys: "r", command: "reorder", label: "reorder" },
  { keys: "c", command: "connect", label: "connect" },
  { keys: "x", command: "disconnect", label: "disconnect" },
  { keys: "Delete", command: "delete", label: "delete" },
  { keys: "Control+z", command: "undo", label: "undo" },
  { keys: "Control+y", command: "redo", label: "redo" },
]);

/** Every command kind the table reaches, so a gesture cannot lose its key. */
const KEYED_COMMANDS = new Set(DESIGNER_KEYS.map((entry) => entry.command));
for (const kind of COMMAND_KINDS) {
  // The two layer commands are reached from the layer panel's own buttons,
  // which are keyboard-operable like any button; everything else needs a key
  // on the canvas, and a kind that lost one would be a gesture reachable only
  // by pointer in a room that has none.
  if (kind === "layer_visibility" || kind === "layer_lock") continue;
  if (!KEYED_COMMANDS.has(kind)) {
    throw new Error(`designer command ${kind} has no keyboard path`);
  }
}

/**
 * Local wording names, mapped to their catalog keys.
 *
 * The wording itself lives in `catalog-de.mjs` and `catalog-en.mjs`. It used
 * to live here as a `COPY` table, which is what made a third locale a code
 * edit in every module that renders anything: a locale is now a catalog, and a
 * catalog is data.
 *
 * This map exists so the call sites below keep naming the string they mean
 * rather than a namespaced key, including the ones that compute a name.
 */
const KEYS = Object.freeze({
  "add": "designer.add",
  "align": "designer.align",
  "canvas_label": "designer.canvas_label",
  "confirm_delete": "designer.confirm_delete",
  "confirm_remove_pack": "designer.confirm_remove_pack",
  "conflict": "designer.conflict",
  "connect": "designer.connect",
  "connect_choose_source": "designer.connect_choose_source",
  "connect_choose_target": "designer.connect_choose_target",
  "connect_refused": "designer.connect_refused",
  "contributes": "designer.contributes",
  "delete": "designer.delete",
  "disconnect": "designer.disconnect",
  "distribute": "designer.distribute",
  "extend_selection": "designer.extend_selection",
  "extensions": "designer.extensions",
  "group": "designer.group",
  "instantiate_master": "designer.instantiate_master",
  "keyboard_help": "designer.keyboard_help",
  "layer_hidden": "designer.layer_hidden",
  "layer_locked": "designer.layer_locked",
  "layer_unlocked": "designer.layer_unlocked",
  "layer_visible": "designer.layer_visible",
  "layers": "designer.layers",
  "minimap_label": "designer.minimap_label",
  "no_extensions": "designer.no_extensions",
  "nothing_selected": "designer.nothing_selected",
  "nudge_coarse": "designer.nudge_coarse",
  "nudge_fine": "designer.nudge_fine",
  "objects": "designer.objects",
  "ready": "designer.ready",
  "redo": "designer.redo",
  "reorder": "designer.reorder",
  "resize": "designer.resize",
  "select": "designer.select",
  "supports": "designer.supports",
  "undo": "designer.undo",
  "undo_depth": "designer.undo_depth",
  "ungroup": "designer.ungroup",
  "viewport": "designer.viewport",
});

// Every name this module renders must resolve in the catalog, in both
// languages. Cross-language completeness is now computed once for every
// namespace in `test/catalog-completeness.test.mjs`; what stays here is the
// half only this module knows — that the names *it* uses exist at all.
for (const catalogKey of Object.values(KEYS)) {
  for (const language of ["de", "en"]) {
    if (!hasWording(catalogKey, language)) {
      throw new Error(`project-designer renders ${catalogKey}, which has no ${language} wording`);
    }
  }
}

/** The wording this module renders, by language. Assembled from the catalog. */
export const PROJECT_DESIGNER_COPY = Object.freeze(Object.fromEntries(
  ["de", "en"].map((language) => [
    language,
    Object.freeze(Object.fromEntries(
      Object.entries(KEYS).map(([local, catalogKey]) => [local, catalogTemplate(catalogKey, language)]),
    )),
  ]),
));

const FINE_STEP = 1;
const COARSE_STEP = 20;

/**
 * Resolve one designer string through the catalog.
 *
 * **There is no fallback.** The three spellings this replaces across nine
 * modules resolved a missing key to the English string or to the raw key, and
 * neither is visible to anyone except the operator it fails: a German operator
 * saw an English sentence, indistinguishable from a term deliberately left in
 * English. An unknown name throws instead, naming what is missing.
 */
function textFor(language, key, values = {}) {
  const catalogKey = KEYS[key];
  if (!catalogKey) throw new Error(`no wording named ${JSON.stringify(key)}`);
  return catalogText(catalogKey, language, values);
}

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

class GltDesignerElement extends HTMLElement {
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
    this.classList.add("glt-des");
    this.render();
  }

  /** Ask the host to run a command. The surface never applies one itself. */
  emit(command) {
    this.dispatchEvent(new CustomEvent("glt-designer-command", {
      detail: command, bubbles: true, composed: true,
    }));
    return command;
  }

  render() {
    this.textContent = "";
  }
}

/**
 * The canvas.
 *
 * Objects are grid cells rather than absolutely positioned boxes with pointer
 * handlers. That is what makes the whole editor reachable by keyboard without
 * a parallel "accessible mode": there is one traversal, and the pointer, where
 * there is one, drives the same cells.
 */
class GltDesignerCanvas extends GltDesignerElement {
  constructor() {
    super();
    this._selection = [];
    this._pendingSource = null;
    this._status = null;
  }

  render() {
    this.textContent = "";
    const language = this.language;
    const state = this._props.state ?? { equipment: [], paths: [], layers: [], groups: [] };
    const objects = state.equipment ?? [];

    this.setAttribute("role", "application");
    this.setAttribute("aria-label", textFor(language, "canvas_label"));
    // Declares that this surface is operable by keyboard, and which table says
    // how. A test reads it; so does anyone wondering where the bindings live.
    this.dataset.keyboard = DESIGNER_KEYS.map((entry) => entry.keys).join(" ");
    this.dataset.undoDepth = String(UNDO_DEPTH_LIMIT);

    const bar = element("div", "glt-des-bar");
    for (const action of ["undo", "redo", "group", "align", "distribute", "delete"]) {
      const button = element("button", null, textFor(language, action));
      button.type = "button";
      button.dataset.action = action;
      button.addEventListener("click", () => this._run(action));
      bar.append(button);
    }
    this.append(bar);

    const live = element("div", "glt-des-live");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.dataset.live = "1";
    live.textContent = this._status?.text
      ?? `${objects.length} ${textFor(language, "objects")} · ${textFor(language, "ready")}`;
    if (this._status?.tone) live.dataset.tone = this._status.tone;
    this.append(live);

    const grid = element("ul", "glt-des-grid");
    // `role="grid"` promises rows. An empty state placed inside one is announced
    // as a row that is not a row, so the role is applied only when there are
    // cells and the empty state is a sibling paragraph instead.
    if (objects.length > 0) grid.setAttribute("role", "grid");
    for (const [index, item] of objects.entries()) {
      const cell = element("li", "glt-des-cell");
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = index === 0 ? 0 : -1;
      cell.dataset.objectId = item.id;
      cell.setAttribute("aria-selected", String(this._selection.includes(item.id)));
      cell.append(element("span", null, item.name ?? item.id));
      cell.append(element("span", "glt-des-meta", `${item.x ?? 0},${item.y ?? 0}`));
      cell.addEventListener("keydown", (event) => this._key(event, item, index, objects));
      cell.addEventListener("focus", () => { this._focused = item.id; });
      grid.append(cell);
    }
    this.append(grid);
    if (objects.length === 0) {
      this.append(element("p", "glt-des-empty", textFor(language, "nothing_selected")));
    }

    this.append(this._help(language));
  }

  _help(language) {
    const wrap = element("section");
    wrap.append(element("h4", "glt-des-meta", textFor(language, "keyboard_help")));
    const list = element("ul", "glt-des-keys");
    for (const entry of DESIGNER_KEYS) {
      const row = element("li", "glt-des-key");
      row.append(element("kbd", "glt-des-kbd", entry.keys));
      row.append(element("span", null, textFor(language, entry.label)));
      list.append(row);
    }
    wrap.append(list);
    wrap.append(element("p", "glt-des-meta",
      `${textFor(language, "undo_depth")}: ${UNDO_DEPTH_LIMIT}`));
    return wrap;
  }

  /** Roving focus plus the command keys. One traversal, no pointer required. */
  _key(event, item, index, objects) {
    const language = this.language;
    const state = this._props.state ?? {};
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

    if (event.key in arrows && (event.shiftKey || event.altKey || event.ctrlKey)) {
      const [dx, dy] = arrows[event.key];
      const step = event.shiftKey ? COARSE_STEP : FINE_STEP;
      event.preventDefault();
      if (event.altKey) {
        this.emit({ kind: "resize", payload: { id: item.id,
          from: { width: item.width, height: item.height },
          to: { width: Math.max(1, (item.width ?? 0) + dx * step),
            height: Math.max(1, (item.height ?? 0) + dy * step) } } });
      } else {
        this.emit({ kind: "move", payload: { id: item.id,
          from: { x: item.x, y: item.y },
          to: { x: (item.x ?? 0) + dx * step, y: (item.y ?? 0) + dy * step } } });
      }
      return;
    }
    if (event.key in arrows) {
      // Plain arrows move focus. A grid where the arrows both move focus and
      // move the object gives the operator no way to look without editing.
      const [dx, dy] = arrows[event.key];
      const next = Math.min(objects.length - 1, Math.max(0, index + (dx || dy)));
      event.preventDefault();
      const cells = this.querySelectorAll('[role="gridcell"]');
      for (const cell of cells) cell.tabIndex = -1;
      cells[next].tabIndex = 0;
      cells[next].focus();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this._selection = event.shiftKey
        ? [...new Set([...this._selection, item.id])]
        : [item.id];
      this.render();
      return;
    }

    const action = {
      g: event.shiftKey ? "ungroup" : "group", a: "align", d: "distribute",
      r: "reorder", c: "connect", x: "disconnect", Delete: "delete",
      Insert: event.shiftKey ? "master_instantiate" : "add",
    }[event.key];
    if (event.ctrlKey && event.key === "z") { event.preventDefault(); this._run("undo"); return; }
    if (event.ctrlKey && event.key === "y") { event.preventDefault(); this._run("redo"); return; }
    if (!action) return;
    event.preventDefault();
    if (action === "connect") { this._connect(item, state, language); return; }
    this._run(action, item);
  }

  /**
   * Connection is two steps: choose a source port, then a target.
   *
   * A refusal is announced in the live region in words. A silent no-op would
   * leave the engineer holding a key that does nothing, which is the worst
   * version of "the tool disagrees with you".
   */
  _connect(item, state, language) {
    const port = (this._props.portsOf ?? (() => []))(item)[0];
    if (!port) return;
    if (!this._pendingSource) {
      this._pendingSource = { item, port };
      this._status = { text: textFor(language, "connect_choose_target"), tone: null };
      this.render();
      return;
    }
    const source = { ...this._pendingSource.port, equipment: this._pendingSource.item.id };
    const target = { ...port, equipment: item.id };
    this._pendingSource = null;
    let verdict;
    try {
      verdict = checkCompatibility(source, target, state.paths ?? []);
    } catch (error) {
      this._status = { text: error.message, tone: "error" };
      this.render();
      return;
    }
    if (!verdict.compatible) {
      this._status = {
        text: `${textFor(language, "connect_refused")}: ${verdict.reason}`,
        tone: "error",
      };
      this.dispatchEvent(new CustomEvent("glt-connection-refused", {
        detail: verdict, bubbles: true, composed: true,
      }));
      this.render();
      return;
    }
    this._status = null;
    this.emit({ kind: "connect", payload: { index: (state.paths ?? []).length, path: {
      id: `conn-${source.equipment}-${target.equipment}`,
      from_equipment: source.equipment, from_port: source.id,
      to_equipment: target.equipment, to_port: target.id,
    } } });
    this.render();
  }

  /**
   * Run one named action.
   *
   * `delete` goes through the Phase-2 confirm element rather than
   * `window.confirm`: a native dialog is a browser-owned authority prompt the
   * kiosk cannot reach and the effect ledger cannot observe.
   */
  _run(action, item) {
    const state = this._props.state ?? { equipment: [], paths: [], layers: [], groups: [] };
    if (action === "undo" || action === "redo") {
      this.dispatchEvent(new CustomEvent(`glt-designer-${action}`, {
        bubbles: true, composed: true,
      }));
      return;
    }
    if (action === "delete") {
      this._confirm("confirm_delete", () => {
        const command = sampleCommand("delete", state);
        if (command) this.emit(command);
      });
      return;
    }
    const command = sampleCommand(action, state);
    if (command) this.emit(command);
    else if (item) this._status = { text: textFor(this.language, "nothing_selected"), tone: null };
  }

  /**
   * Confirm a destructive step through the Phase-2 element.
   *
   * Its contract is Phase 2's, unchanged: a `control` describing what is about
   * to happen, and two callbacks. Reusing it rather than writing a second
   * confirmation is the point -- one element means one place where the safe
   * choice takes focus, and it already does.
   */
  _confirm(messageKey, onConfirm) {
    const existing = this.querySelector("glt-flow-card-control-confirm");
    if (existing) existing.remove();
    const confirm = document.createElement("glt-flow-card-control-confirm");
    confirm.dataset.confirm = messageKey;
    // The confirm element is the Phase-2 one, so its own wording — heading,
    // effect, target, the two buttons — belongs to that surface's namespace.
    // The designer supplies only the message. Routing everything through the
    // designer's names used to work because the lookup fell back to the key
    // itself; without that fallback, asking the wrong namespace is a defect
    // rather than a slightly worse dialog, and the dialog it produced had no
    // focusable control at all.
    confirm.copy = (key, values) => (
      key === "controlConfirmBody"
        ? textFor(this.language, messageKey)
        : projectSafetyCopy(this.language, key, values)
    );
    this.append(confirm);
    confirm.props = {
      control: {
        phase: "confirm",
        controlId: messageKey,
        preview: { label: textFor(this.language, messageKey), summary: textFor(this.language, messageKey) },
      },
      onConfirm: () => {
        confirm.remove();
        onConfirm();
      },
      onCancel: () => confirm.remove(),
    };
  }
}

/** Layer visibility, locking and order, all as commands. */
class GltLayerPanel extends GltDesignerElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const layers = this._props.state?.layers ?? [];
    this.setAttribute("role", "region");
    this.setAttribute("aria-label", textFor(language, "layers"));
    if (layers.length === 0) {
      this.append(element("p", "glt-des-empty", textFor(language, "nothing_selected")));
      return;
    }
    const list = element("ul", "glt-des-list");
    for (const layer of layers) {
      const row = element("li", "glt-des-item");
      row.dataset.layerId = layer.id;
      row.append(element("span", null, layer.name ?? layer.id));
      for (const [field, onKey, offKey] of [
        ["visible", "layer_visible", "layer_hidden"],
        ["locked", "layer_locked", "layer_unlocked"],
      ]) {
        const button = element("button", null,
          textFor(language, layer[field] ? onKey : offKey));
        button.type = "button";
        button.dataset.toggle = field;
        button.setAttribute("aria-pressed", String(Boolean(layer[field])));
        button.addEventListener("click", () => this.emit({
          kind: field === "visible" ? "layer_visibility" : "layer_lock",
          payload: { id: layer.id, from: Boolean(layer[field]), to: !layer[field] },
        }));
        row.append(button);
      }
      list.append(row);
    }
    this.append(list);
  }
}

/**
 * The whole diagram at a glance, pannable by keyboard.
 *
 * Drawn as list rows rather than a canvas bitmap: an overview nobody can read
 * without a pointer is not an overview in a room that has none.
 */
class GltMinimap extends GltDesignerElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const objects = this._props.state?.equipment ?? [];
    const viewport = this._props.viewport ?? { x: 0, y: 0, width: 0, height: 0 };

    this.setAttribute("role", "region");
    this.setAttribute("aria-label", textFor(language, "minimap_label"));
    const map = element("div", "glt-des-map");
    map.tabIndex = 0;
    map.dataset.minimap = "1";
    map.setAttribute("role", "group");
    // The box is focusable, so it needs a name of its own: the region's label
    // does not carry to a descendant a keyboard user lands on directly.
    map.setAttribute("aria-label", textFor(language, "minimap_label"));
    map.append(element("p", "glt-des-meta",
      `${textFor(language, "viewport")}: ${viewport.x},${viewport.y}`));
    const list = element("ul", "glt-des-list");
    for (const item of objects) {
      const row = element("li", "glt-des-item");
      row.dataset.objectId = item.id;
      row.append(element("span", null, item.name ?? item.id));
      row.append(element("span", "glt-des-meta", `${item.x ?? 0},${item.y ?? 0}`));
      list.append(row);
    }
    map.append(list);
    map.addEventListener("keydown", (event) => {
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (!(event.key in arrows)) return;
      event.preventDefault();
      const [dx, dy] = arrows[event.key];
      this.dispatchEvent(new CustomEvent("glt-viewport-panned", {
        detail: { x: viewport.x + dx * COARSE_STEP, y: viewport.y + dy * COARSE_STEP },
        bubbles: true, composed: true,
      }));
    });
    this.append(map);
  }
}

/** Installed packs, what each contributes, and any conflict, in words. */
class GltExtensionManager extends GltDesignerElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const packs = this._props.packs ?? [];
    this.setAttribute("role", "region");
    this.setAttribute("aria-label", textFor(language, "extensions"));

    if (packs.length === 0) {
      this.append(element("p", "glt-des-empty", textFor(language, "no_extensions")));
      return;
    }
    const list = element("ul", "glt-des-list");
    for (const pack of packs) {
      const row = element("li", "glt-des-item");
      row.dataset.namespace = pack.namespace;
      row.append(element("strong", null, pack.namespace));
      row.append(element("span", "glt-des-meta", pack.version));
      const kinds = Object.entries(pack.contributions ?? {})
        .map(([kind, count]) => `${count} ${kind}`).join(" · ");
      row.append(element("span", null, `${textFor(language, "contributes")}: ${kinds || "—"}`));
      row.append(element("span", "glt-des-meta",
        `${textFor(language, "supports")} ${(pack.supports_schema_versions ?? []).join(", ")}`));
      const remove = element("button", null, textFor(language, "delete"));
      remove.type = "button";
      remove.dataset.removePack = pack.namespace;
      remove.addEventListener("click", () => {
        // Removing a pack can invalidate every diagram that draws with it, so
        // it is confirmed the same way a control is -- through the Phase-2
        // element, never `window.confirm`.
        const confirm = document.createElement("glt-flow-card-control-confirm");
        confirm.dataset.confirm = "confirm_remove_pack";
        confirm.copy = (key) => textFor(language, key) || key;
        this.append(confirm);
        confirm.props = {
          control: {
            phase: "confirm",
            controlId: pack.namespace,
            preview: {
              label: textFor(language, "confirm_remove_pack"),
              summary: `${pack.namespace} ${pack.version}`,
            },
          },
          onConfirm: () => {
            confirm.remove();
            this.dispatchEvent(new CustomEvent("glt-extension-remove-requested", {
              detail: { namespace: pack.namespace }, bubbles: true, composed: true,
            }));
          },
          onCancel: () => confirm.remove(),
        };
      });
      row.append(remove);
      list.append(row);
    }
    this.append(list);

    for (const conflict of this._props.conflicts ?? []) {
      const strip = element("div", "glt-des-live");
      strip.dataset.tone = "error";
      strip.dataset.conflict = conflict.namespace ?? "";
      strip.append(element("strong", null, textFor(language, "conflict")));
      strip.append(element("span", null,
        `${conflict.namespace} ↔ ${conflict.conflicts_with}: ${(conflict.contested ?? []).join(", ")}`));
      this.append(strip);
    }
  }
}

/**
 * Publish the router to the v0.4 editor region.
 *
 * The two halves of this card are separate bundles concatenated into one file,
 * with no module linkage between them, so a namespaced global is the only
 * honest way for the older editor to reach the newer router. It is published
 * rather than duplicated: the alternative is two routers, and the one nobody
 * tests is the one the editor actually uses.
 *
 * The legacy `autoRoute` refuses to draw anything when this is absent, so a
 * load order that failed to publish it produces a diagram with no new routes
 * rather than a diagram full of midpoint elbows through the plant.
 */
if (typeof globalThis !== "undefined") {
  globalThis.GLT_FLOW_CARD_ROUTING = Object.freeze({
    DEFAULT_CLEARANCE, DEFAULT_SPACING, createRouter, relevantObstacles, routeNetwork, routePath,
  });
}

if (typeof document !== "undefined" && !document.querySelector("style[data-glt-designer]")) {
  const style = element("style");
  style.dataset.gltDesigner = "1";
  style.textContent = STYLE;
  document.head?.append(style);
}

for (const [name, constructor] of [
  ["glt-flow-card-designer-canvas", GltDesignerCanvas],
  ["glt-flow-card-layer-panel", GltLayerPanel],
  ["glt-flow-card-minimap", GltMinimap],
  ["glt-flow-card-extension-manager", GltExtensionManager],
]) {
  defineElement(name, constructor);
}
