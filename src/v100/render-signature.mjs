/**
 * One fingerprint of everything a render reads from Home Assistant.
 *
 * `set hass` fires on every state churn on the instance — a busy plant can
 * publish several updates per second, and a card with two thousand objects
 * rebuilds its whole shadow DOM each time even when none of its own entities
 * moved. The signature reduces one `hass` object to the pieces the render
 * actually reads: the locale, the acting user, the theme's dark mode, and the
 * state objects of the entities the configuration references. When a new
 * `hass` produces the same signature, the render would produce the same bytes,
 * so the card skips straight to the next frame.
 *
 * `last_updated` rather than `state` alone: it advances whenever the state
 * *object* is replaced, including attribute-only changes such as a unit or a
 * friendly name — both of which the render displays. `last_changed` would miss
 * exactly those renders and present a stale screen as fresh.
 */
export function renderSignature(hass, entityIds) {
  if (!hass) return "hass:absent";
  let signature = `locale:${hass.locale?.language ?? ""}`;
  const user = hass.user;
  if (user) signature += `|user:${user.id ?? ""}:${user.is_admin ? "admin" : "member"}`;
  const themes = hass.themes;
  if (themes && typeof themes === "object") {
    signature += `|theme:${themes.darkMode ? "dark" : "light"}`;
  }
  const states = hass.states ?? {};
  // Order-independent: the same configuration collected through different
  // paths must fingerprint the same, or a rebuilt cache would read as change.
  const ordered = [...entityIds].sort();
  for (const entityId of ordered) {
    const stateObj = states[entityId];
    if (!stateObj) {
      signature += `|${entityId}:-`;
      continue;
    }
    signature += `|${entityId}:${stateObj.state}:${stateObj.last_updated ?? stateObj.last_changed ?? ""}`;
  }
  return signature;
}
