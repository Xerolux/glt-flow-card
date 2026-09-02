/* Phase-9 multi-site supervision surfaces.
 *
 * One rule governs them: **a view that is missing a site says so, in the view.**
 * Not in a console, not behind a hover, not as a subtly different shade.
 *
 * The whole value of a central supervision screen is that a person stops looking
 * at five screens. The moment they do, an unnoticed missing site is a plant
 * nobody is watching — which is why this phase's characteristic defect is *an
 * answer that is incomplete and does not say so*, and why these assertions are
 * about safety rather than styling.
 *
 * Three consequences from `09-UI-SPEC.md`:
 *
 * **Every remote value carries its age and its site's health.** A value read an
 * hour ago from a site that has been unreachable since reads exactly like a
 * current one otherwise.
 *
 * **`unreachable` and `circuit_open` are visibly different words.** One was
 * asked and did not answer; the other was *not asked*, because it has been
 * failing. Showing them identically hides how long the problem has existed.
 *
 * **Nothing offers a retry beside an unknown.** A remote timeout is
 * `effect_unknown`, and a retry button next to it invites operating plant twice.
 *
 * Site names and remote entity attributes are authored somewhere this
 * installation does not control, which makes them the most hostile input the
 * product handles. They are set as text content and never interpolated into
 * markup.
 */

const LANGUAGES = ["de", "en"];

/** Wording, written out in both languages rather than assembled from fragments. */
const TEXT = {
  siteHealthy: { de: "erreichbar", en: "reachable" },
  siteSlow: { de: "langsam", en: "slow" },
  siteUnreachable: { de: "nicht erreichbar", en: "unreachable" },
  siteCircuitOpen: { de: "ausgesetzt nach wiederholten Fehlern", en: "suspended after repeated failures" },
  shapeHealthy: { de: "●", en: "●" },
  shapeSlow: { de: "◐", en: "◐" },
  shapeUnreachable: { de: "○", en: "○" },
  shapeCircuitOpen: { de: "✕", en: "✕" },
  age: {
    de: (seconds) => `Stand vor ${seconds} s`,
    en: (seconds) => `read ${seconds} s ago`,
  },
  unverifiedTls: {
    de: "unverschlüsselt geprüft: Zertifikat wird für diesen Standort nicht geprüft",
    en: "unverified: this site's certificate is not checked",
  },
  completeness: {
    de: (answered, total) => `${answered} von ${total} Standorten geantwortet`,
    en: (answered, total) => `${answered} of ${total} sites answered`,
  },
  missingSites: {
    de: "Fehlende Standorte:",
    en: "Missing sites:",
  },
  effectUnknown: {
    de: "Wirkung unbekannt — der Befehl kann ausgeführt worden sein. Prüfen Sie den Anlagenzustand, bevor Sie etwas erneut senden.",
    en: "Effect unknown — the command may have run. Check the plant state before sending anything again.",
  },
  noValue: { de: "kein Messwert", en: "no reading" },
};

for (const key of Object.keys(TEXT)) {
  for (const language of LANGUAGES) {
    if (TEXT[key][language] === undefined) {
      throw new Error(`site surfaces: "${key}" has no ${language} wording`);
    }
  }
}

function text(key, language, ...args) {
  const entry = TEXT[key]?.[language] ?? TEXT[key]?.en;
  return typeof entry === "function" ? entry(...args) : entry;
}

/** Append a child carrying remote text, set as text content and never markup. */
function append(parent, tag, value, attributes = {}) {
  const node = document.createElement(tag);
  for (const [name, attribute] of Object.entries(attributes)) {
    if (attribute !== null && attribute !== undefined) node.setAttribute(name, String(attribute));
  }
  if (value !== null && value !== undefined) node.textContent = String(value);
  parent.append(node);
  return node;
}

const STATE_KEYS = {
  healthy: ["siteHealthy", "shapeHealthy"],
  slow: ["siteSlow", "shapeSlow"],
  unreachable: ["siteUnreachable", "shapeUnreachable"],
  circuit_open: ["siteCircuitOpen", "shapeCircuitOpen"],
};

/**
 * One site's health, as a word and a shape.
 *
 * `unreachable` and `circuit_open` get different words *and* different shapes,
 * because the distinction is the useful one: a site suspended after repeated
 * failures has been broken for a while, and a site that did not answer just
 * failed now.
 */
class SiteHealthBadge extends HTMLElement {
  set props({ site = null, language = "de" }) {
    this.replaceChildren();
    if (!site) return;
    const state = STATE_KEYS[site.state] ? site.state : "unreachable";
    const [wordKey, shapeKey] = STATE_KEYS[state];
    this.setAttribute("data-site", site.site_id ?? "");
    this.setAttribute("data-site-state", state);

    append(this, "span", site.site_id, { "data-site-name": "" });
    append(this, "span", TEXT[shapeKey][language], { "data-site-shape": "" });
    append(this, "span", text(wordKey, language), { "data-site-state-text": "" });

    if (Number.isFinite(site.age_seconds)) {
      append(this, "span", text("age", language, Math.round(site.age_seconds)), {
        "data-site-age": "",
      });
    }
    if (site.verified_tls === false) {
      // Stated wherever the site's figures appear, so an operator can see which
      // numbers arrived over an unauthenticated channel.
      append(this, "span", text("unverifiedTls", language), { "data-unverified-tls": "" });
    }
  }
}

/**
 * A portfolio figure that states its own completeness.
 *
 * "3 of 5 sites" beside the number, and the two absent sites **named**: a count
 * tells a reader that something is missing, and a name tells them where to go
 * and look.
 */
class PortfolioRollup extends HTMLElement {
  set props({ rollup = null, language = "de" }) {
    this.replaceChildren();
    if (!rollup) return;
    const answered = rollup.answered_sites ?? [];
    const absent = rollup.absent_sites ?? [];
    this.setAttribute("data-complete", String(Boolean(rollup.complete)));

    append(this, "span", rollup.label ?? "", { "data-rollup-label": "" });
    append(this, "span", rollup.total ?? text("noValue", language), { "data-rollup-total": "" });
    // Always rendered, complete or not. A completeness note that appeared only
    // when something was missing would make its absence mean "we did not check"
    // — the same reasoning as Phase 7's coverage badge at 100 %.
    append(this, "span", text("completeness", language, answered.length, rollup.total_sites ?? 0), {
      "data-completeness": "",
    });

    if (absent.length > 0) {
      append(this, "span", text("missingSites", language), { "data-missing-label": "" });
      const list = append(this, "ul", null, { "data-missing": "" });
      for (const entry of absent) {
        const item = append(list, "li", null, { "data-missing-site": entry.site_id });
        append(item, "span", entry.site_id, { "data-site-name": "" });
        const state = STATE_KEYS[entry.state] ? entry.state : "unreachable";
        append(item, "span", TEXT[STATE_KEYS[state][1]][language], { "data-site-shape": "" });
        append(item, "span", text(STATE_KEYS[state][0], language), { "data-site-state-text": "" });
      }
    }
  }
}

/**
 * One remote value, with its age and its site's health beside it.
 *
 * Both travel with the value rather than only in a banner, because a banner
 * scrolls away and a value does not — and a value read an hour ago from a site
 * unreachable since reads exactly like a current one otherwise.
 */
class RemoteValue extends HTMLElement {
  set props({ value = null, unit = "", site = null, language = "de" }) {
    this.replaceChildren();
    const state = site && STATE_KEYS[site.state] ? site.state : "unreachable";
    this.setAttribute("data-site-state", state);
    const missing = value === null || value === undefined;
    append(this, "span", missing ? text("noValue", language) : value, { "data-value": "" });
    if (!missing && unit) append(this, "span", unit, { "data-unit": "" });

    const badge = document.createElement("glt-flow-card-site-health-badge");
    this.append(badge);
    badge.props = { site: site ?? { site_id: "", state }, language };
  }
}

/**
 * A remote command outcome.
 *
 * `effect_unknown` renders its sentence and **no action**. A retry beside an
 * unknown invites operating plant twice, and Phase 4 established that repairing
 * forward is a new, separately authorized command.
 */
class RemoteOutcome extends HTMLElement {
  set props({ outcome = "failed", reason = null, language = "de" }) {
    this.replaceChildren();
    this.setAttribute("data-outcome", outcome);
    if (reason) this.setAttribute("data-reason", reason);
    if (outcome === "effect_unknown") {
      append(this, "span", text("effectUnknown", language), { "data-effect-unknown": "" });
      // Deliberately no retry control here. Asserted by the spec, because the
      // tempting addition is exactly the dangerous one.
      return;
    }
    append(this, "span", outcome, { "data-outcome-text": "" });
  }
}

const ELEMENTS = [
  ["glt-flow-card-site-health-badge", SiteHealthBadge],
  ["glt-flow-card-portfolio-rollup", PortfolioRollup],
  ["glt-flow-card-remote-value", RemoteValue],
  ["glt-flow-card-remote-outcome", RemoteOutcome],
];

for (const [name, constructor] of ELEMENTS) {
  if (!customElements.get(name)) customElements.define(name, constructor);
}
