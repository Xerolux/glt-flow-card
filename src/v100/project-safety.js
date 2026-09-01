import { evaluateProjectContract } from "./project-contract.mjs";
import { readProjectBundleArchive } from "./project-bundle.mjs";
import { projectSafetyCopy, projectSafetyLocale } from "./project-safety-i18n.mjs";

const Editor = customElements.get("glt-flow-card-editor");

const STYLE = `
  .glt-safe-trigger{min-height:31px}
  .glt-safe-modal{position:fixed;inset:0;z-index:13000;display:grid;place-items:center;padding:16px;background:#020617bd;backdrop-filter:blur(3px)}
  .glt-safe-dialog{display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;width:min(1120px,calc(100vw - 32px));max-height:92vh;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:16px;background:var(--bg,var(--card-background-color,#0a1826));color:var(--tx,var(--primary-text-color,#edf6ff));box-shadow:0 24px 70px #02061788;font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
  .glt-safe-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px;border-bottom:1px solid var(--b,var(--divider-color,#19334a))}
  .glt-safe-head h2{font-size:24px;line-height:1.2;margin:0}.glt-safe-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;color:var(--mut,var(--secondary-text-color,#8198ad));font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
  .glt-safe-close,.glt-safe-btn,.glt-safe-tab{min-height:44px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:8px;background:transparent;color:inherit;padding:8px 12px;font:700 14px/1.5 inherit;cursor:pointer}
  .glt-safe-close{min-width:44px;padding:8px}.glt-safe-btn.primary{background:var(--e,#0aa8ff);border-color:var(--e,#0aa8ff);color:#fff}.glt-safe-btn:disabled{cursor:not-allowed;opacity:.55}
  .glt-safe-close:focus-visible,.glt-safe-btn:focus-visible,.glt-safe-tab:focus-visible,.glt-safe-dialog input:focus-visible{outline:2px solid var(--e,#36c7ff);outline-offset:2px}
  .glt-safe-banner{padding:12px 16px;border-bottom:1px solid var(--b,var(--divider-color,#19334a));background:color-mix(in srgb,var(--e,#0aa8ff) 10%,transparent);font-weight:700}
  .glt-safe-banner.readonly{background:color-mix(in srgb,#8198ad 16%,transparent)}
  .glt-safe-tabs{display:flex;gap:4px;overflow-x:auto;padding:8px 16px;border-bottom:1px solid var(--b,var(--divider-color,#19334a));scrollbar-width:thin}.glt-safe-tab{white-space:nowrap;border-color:transparent;color:var(--mut,var(--secondary-text-color,#8198ad))}.glt-safe-tab[aria-selected="true"]{color:var(--e,#36c7ff);border-color:var(--e,#0aa8ff);background:color-mix(in srgb,var(--e,#0aa8ff) 10%,transparent)}
  .glt-safe-content{min-width:0;overflow:auto;padding:24px}.glt-safe-content h3{font-size:18px;line-height:1.3;margin:0 0 16px}.glt-safe-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:16px}.glt-safe-card{min-width:0;padding:16px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:10px;background:color-mix(in srgb,var(--bg,var(--card-background-color,#0a1826)) 94%,var(--mut,#8198ad) 6%)}.glt-safe-card h4{margin:0 0 8px;font-size:14px}.glt-safe-value{font-weight:700;overflow-wrap:anywhere}.glt-safe-help,.glt-safe-code{color:var(--mut,var(--secondary-text-color,#8198ad));font-size:12px}.glt-safe-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
  .glt-safe-status{display:flex;align-items:center;gap:8px;margin:0 0 16px;padding:12px;border:1px solid currentColor;border-radius:10px}.glt-safe-status.pass{color:#31d879}.glt-safe-status.fail{color:#ff4f4f}.glt-safe-status.info{color:var(--e,#36c7ff)}
  .glt-safe-table{width:100%;border-collapse:collapse}.glt-safe-table th,.glt-safe-table td{padding:8px;border-bottom:1px solid var(--b,var(--divider-color,#19334a));text-align:left;vertical-align:top}.glt-safe-table th{font-size:12px}.glt-safe-table td{overflow-wrap:anywhere}.glt-safe-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.glt-safe-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--b,var(--divider-color,#19334a));background:var(--bg,var(--card-background-color,#0a1826))}
  @media(max-width:767px){.glt-safe-modal{padding:0}.glt-safe-dialog{width:100vw;max-height:none;height:100dvh;border:0;border-radius:0}.glt-safe-content{padding:16px}.glt-safe-table,.glt-safe-table tbody,.glt-safe-table tr,.glt-safe-table th,.glt-safe-table td{display:block}.glt-safe-table thead{display:none}.glt-safe-table tr{padding:8px 0;border-bottom:1px solid var(--b,var(--divider-color,#19334a))}.glt-safe-table td{border:0}.glt-safe-table td::before{content:attr(data-label);display:block;color:var(--mut,var(--secondary-text-color,#8198ad));font-size:12px;font-weight:700}}
  @media(forced-colors:active){.glt-safe-dialog,.glt-safe-card,.glt-safe-status,.glt-safe-btn,.glt-safe-tab{border:1px solid CanvasText}.glt-safe-tab[aria-selected="true"]{outline:2px solid Highlight}}
  @media(prefers-reduced-motion:reduce){.glt-safe-modal,.glt-safe-dialog,.glt-safe-tab{scroll-behavior:auto;transition:none!important;animation:none!important}}
`;

function copyFor(editor, key, values) {
  const locale = projectSafetyLocale(editor._hass || editor._glt4Hass, document.documentElement.lang);
  return projectSafetyCopy(locale, key, values);
}

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function button(label, className = "glt-safe-btn") {
  const node = element("button", className, label);
  node.type = "button";
  return node;
}

function card(title, value, detail) {
  const node = element("section", "glt-safe-card");
  node.append(element("h4", "", title), element("div", "glt-safe-value", value));
  if (detail) node.append(element("div", "glt-safe-help", detail));
  return node;
}

function status(kind, text) {
  const node = element("div", `glt-safe-status ${kind}`);
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.append(element("span", "", kind === "pass" ? "✓" : kind === "fail" ? "×" : "○"), element("strong", "", text));
  return node;
}

function focusable(dialog) {
  return [...dialog.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])")]
    .filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true");
}

function renderOverview(editor, state, content) {
  content.append(element("h3", "", copyFor(editor, "overview")));
  const grid = element("div", "glt-safe-grid");
  const project = editor._config?.project || {};
  grid.append(
    card(copyFor(editor, "rawContract"), `${copyFor(editor, "schema")} ${editor._config?.schema_version ?? "—"}`, state.validation?.valid === true ? copyFor(editor, "validationSuccess") : copyFor(editor, "notRun")),
    card(copyFor(editor, "project"), project.name || project.id || "—", `${copyFor(editor, "revision")} ${project.revision ?? 0}`),
    card(copyFor(editor, "companion"), editor._hass?.callWS ? copyFor(editor, "connected") : copyFor(editor, "readOnly")),
    card(copyFor(editor, "bundleSafety"), copyFor(editor, "notRun")),
    card(copyFor(editor, "releaseEvidence"), copyFor(editor, "byteIdentical"), `v${window.GLTFlowCardSDK?.version || "—"}`),
  );
  content.append(grid);
  const actions = element("div", "glt-safe-actions");
  const validate = button(copyFor(editor, "validate"), "glt-safe-btn primary");
  validate.addEventListener("click", () => {
    state.tab = 1;
    state.runValidation = true;
    state.render();
  });
  actions.append(validate);
  content.append(actions);
}

function renderValidation(editor, state, content) {
  content.append(element("h3", "", copyFor(editor, "validate")));
  if (!state.validation) {
    content.append(status("info", copyFor(editor, "validationIdle")));
  } else if (state.validation.valid) {
    content.append(status("pass", copyFor(editor, "validationSuccess")));
    content.append(element("p", "", copyFor(editor, "validationValid", { version: state.validation.schema_version })));
    content.append(element("p", "glt-safe-code", copyFor(editor, "unchanged")));
  } else {
    content.append(status("fail", copyFor(editor, "validationFailed")));
    content.append(element("p", "", copyFor(editor, "validationInvalid")));
    const table = element("table", "glt-safe-table");
    const head = element("thead");
    const headRow = element("tr");
    for (const label of ["Code", copyFor(editor, "path"), "Message"]) headRow.append(element("th", "", label));
    head.append(headRow);
    const body = element("tbody");
    for (const issue of state.validation.errors || []) {
      const row = element("tr");
      for (const [label, value] of [["Code", issue.code], [copyFor(editor, "path"), issue.path], ["Message", issue.message || JSON.stringify(issue.params || {})]]) {
        const cell = element("td", "glt-safe-code", value);
        cell.dataset.label = label;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    content.append(table);
  }
  const actions = element("div", "glt-safe-actions");
  const validate = button(copyFor(editor, "validate"), "glt-safe-btn primary");
  validate.addEventListener("click", () => {
    state.validation = evaluateProjectContract(editor._config);
    state.render();
  });
  actions.append(validate);
  content.append(actions);
  if (state.runValidation) {
    state.runValidation = false;
    queueMicrotask(() => validate.click());
  }
}

function renderMigration(editor, content) {
  content.append(element("h3", "", copyFor(editor, "tabs")[2]));
  content.append(status("info", editor._hass?.callWS ? copyFor(editor, "notRun") : copyFor(editor, "standalone")));
  content.append(element("p", "glt-safe-help", copyFor(editor, "scope")));
}

function appendAssetTable(editor, content, assets) {
  content.append(element("h3", "", copyFor(editor, "assetMetadata")));
  const table = element("table", "glt-safe-table");
  const head = element("thead");
  const headRow = element("tr");
  const labels = [copyFor(editor, "path"), copyFor(editor, "mediaType"), copyFor(editor, "size"), copyFor(editor, "checksum")];
  for (const label of labels) headRow.append(element("th", "", label));
  head.append(headRow);
  const body = element("tbody");
  for (const asset of assets) {
    const row = element("tr");
    const values = [asset.path || asset.id || "—", asset.media_type || "—", String(asset.size ?? "—"), asset.sha256 || "—"];
    values.forEach((value, index) => {
      const cell = element("td", "glt-safe-code", value);
      cell.dataset.label = labels[index];
      row.append(cell);
    });
    body.append(row);
  }
  table.append(head, body);
  content.append(table);
}

function renderBundles(editor, state, content) {
  content.append(element("p", "glt-safe-help", copyFor(editor, "bundleEmpty")));
  appendAssetTable(editor, content, state.bundle?.assets || editor._config?.assets || []);
  const input = element("input");
  input.type = "file";
  input.accept = ".gltproject,application/zip";
  input.hidden = true;
  const inspect = button(copyFor(editor, "inspectBundle"));
  inspect.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      state.bundle = await readProjectBundleArchive(await file.arrayBuffer());
      state.bundleError = null;
    } catch (error) {
      state.bundleError = error;
    }
    state.render();
  });
  const actions = element("div", "glt-safe-actions");
  actions.append(inspect, input);
  content.append(actions);
  if (state.bundleError) content.append(status("fail", String(state.bundleError.message || state.bundleError)));
}

function renderEvidence(editor, content) {
  content.append(element("h3", "", copyFor(editor, "releaseEvidence")));
  const grid = element("div", "glt-safe-grid");
  grid.append(
    card(copyFor(editor, "exactCardVersion"), window.GLTFlowCardSDK?.version || "—"),
    card(copyFor(editor, "artifactEquality"), copyFor(editor, "byteIdentical"), "dist/glt-flow-card.js = Companion www"),
  );
  content.append(grid, element("p", "glt-safe-help", copyFor(editor, "noEvidence")));
}

function openProjectSafety(editor, trigger) {
  editor.shadowRoot.querySelector(".glt-safe-modal")?.remove();
  const state = { tab: 0, validation: null, bundle: null, bundleError: null, runValidation: false };
  const modal = element("div", "glt-safe-modal");
  const dialog = element("section", "glt-safe-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  const titleId = `glt-safe-title-${Math.random().toString(36).slice(2)}`;
  dialog.setAttribute("aria-labelledby", titleId);
  const head = element("header", "glt-safe-head");
  const headingWrap = element("div");
  const heading = element("h2", "", copyFor(editor, "title"));
  heading.id = titleId;
  const project = editor._config?.project || {};
  const meta = element("div", "glt-safe-meta");
  meta.append(element("span", "", project.name || project.id || "—"), element("span", "", `${copyFor(editor, "schema")} ${editor._config?.schema_version ?? "—"}`), element("span", "", `${copyFor(editor, "revision")} ${project.revision ?? 0}`));
  headingWrap.append(heading, meta);
  const close = button("×", "glt-safe-close");
  close.setAttribute("aria-label", copyFor(editor, "close"));
  head.append(headingWrap, close);
  const banner = element("div", "glt-safe-banner", copyFor(editor, "scope"));
  const tabs = element("div", "glt-safe-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", copyFor(editor, "title"));
  const content = element("main", "glt-safe-content");
  const footer = element("footer", "glt-safe-footer");
  const footerClose = button(copyFor(editor, "close"));
  footer.append(footerClose);
  dialog.append(head, banner, tabs, content, footer);
  modal.append(dialog);
  editor.shadowRoot.append(modal);

  const closeDialog = () => {
    modal.remove();
    trigger.focus();
  };
  close.addEventListener("click", closeDialog);
  footerClose.addEventListener("click", closeDialog);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDialog();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = focusable(dialog);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes.at(-1);
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first.focus();
    }
  });

  state.render = () => {
    tabs.replaceChildren();
    const labels = copyFor(editor, "tabs");
    labels.forEach((label, index) => {
      const tab = button(label, "glt-safe-tab");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(index === state.tab));
      tab.tabIndex = index === state.tab ? 0 : -1;
      tab.addEventListener("click", () => {
        state.tab = index;
        state.render();
      });
      tab.addEventListener("keydown", (event) => {
        const movement = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (movement === undefined && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        state.tab = event.key === "Home" ? 0 : event.key === "End" ? labels.length - 1 : (index + movement + labels.length) % labels.length;
        state.render();
        tabs.querySelectorAll('[role="tab"]')[state.tab].focus();
      });
      tabs.append(tab);
    });
    content.replaceChildren();
    if (!editor._hass?.callWS) {
      const unavailable = element("div", "glt-safe-banner readonly", copyFor(editor, "standalone"));
      content.append(unavailable);
    }
    if (state.tab === 0) renderOverview(editor, state, content);
    if (state.tab === 1) renderValidation(editor, state, content);
    if (state.tab === 2) renderMigration(editor, content);
    if (state.tab === 3) renderBundles(editor, state, content);
    if (state.tab === 4) renderEvidence(editor, content);
  };
  state.render();
  queueMicrotask(() => close.focus());
}

function installProjectSafety(editor) {
  const root = editor.shadowRoot;
  if (!root) return;
  if (!root.querySelector("style[data-glt-project-safety]")) {
    const style = element("style");
    style.dataset.gltProjectSafety = "1";
    style.textContent = STYLE;
    root.append(style);
  }
  const projects = root.querySelector('.glt4-bar [data-g4="projects"]');
  if (!projects) return;
  const existing = root.querySelector("[data-glt-project-safety-trigger]");
  const label = copyFor(editor, "title");
  if (existing) {
    existing.textContent = label;
    existing.setAttribute("aria-label", label);
    return;
  }
  const trigger = button(label, "glt4-btn glt-safe-trigger");
  trigger.dataset.gltProjectSafetyTrigger = "1";
  trigger.setAttribute("aria-label", label);
  trigger.addEventListener("click", () => openProjectSafety(editor, trigger));
  projects.after(trigger);
}

if (Editor) {
  const originalRender = Editor.prototype._render;
  Editor.prototype._render = function projectSafetyRender() {
    const result = originalRender.call(this);
    installProjectSafety(this);
    return result;
  };
  const hassDescriptor = Object.getOwnPropertyDescriptor(Editor.prototype, "hass");
  if (hassDescriptor?.set) {
    Object.defineProperty(Editor.prototype, "hass", {
      configurable: true,
      get: hassDescriptor.get,
      set(value) {
        hassDescriptor.set.call(this, value);
        installProjectSafety(this);
      },
    });
  }
  if (window.GLTFlowCardSDK) window.GLTFlowCardSDK.projectSafety = { version: 1, tabs: 5 };
}
